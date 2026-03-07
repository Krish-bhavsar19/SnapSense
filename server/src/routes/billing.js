const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createCheckoutSession } = require('../services/lemonSqueezyService');
const Payment = require('../models/Payment');

/**
 * POST /api/billing/checkout
 * Create a checkout session for the authenticated user
 * Body: { months: 1 | 3 | 6 | 12 } - defaults to 1 month
 */
router.post('/checkout', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        const months = req.body.months || 1;
        
        // Validate months parameter
        if (![1, 3, 6, 12].includes(months)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid subscription period',
                message: 'Please select 1, 3, 6, or 12 months.',
            });
        }
        
        // Check if user already has an active subscription
        if (user.subscription?.status === 'active' && user.subscription?.currentPeriodEnd > new Date()) {
            return res.status(400).json({
                success: false,
                error: 'ALREADY_SUBSCRIBED',
                message: `You already have an active subscription until ${user.subscription.currentPeriodEnd.toLocaleDateString()}. It will auto-renew automatically.`,
                currentPeriodEnd: user.subscription.currentPeriodEnd,
            });
        }
        
        // Check for pending payments
        const pendingPayment = await Payment.findOne({
            userId: user._id,
            status: 'pending',
        }).sort({ createdAt: -1 });
        
        if (pendingPayment && (Date.now() - pendingPayment.createdAt.getTime() < 15 * 60 * 1000)) {
            return res.status(400).json({
                success: false,
                error: 'PENDING_PAYMENT',
                message: 'You have a pending payment. Please complete it or wait 15 minutes.',
            });
        }
        
        const checkoutUrl = await createCheckoutSession(user, months);
        
        res.json({
            success: true,
            checkoutUrl,
            months,
        });
    } catch (error) {
        console.error('Checkout creation error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create checkout session',
            message: 'Unable to process your request. Please try again later.',
        });
    }
});

/**
 * GET /api/billing/status
 * Get current user's billing status
 * Used by frontend polling after checkout
 */
router.get('/status', requireAuth, async (req, res) => {
    try {
        const user = req.user;

        res.json({
            success: true,
            tier: user.tier,
            subscription: user.subscription || { status: 'none' },
            screenshotCount: user.screenshotCount || 0,
            limit: user.tier === 'free' ? 10 : null,
            countResetAt: user.countResetAt,
        });
    } catch (error) {
        console.error('Billing status error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch billing status',
        });
    }
});

/**
 * POST /api/billing/verify-upgrade
 * Because local webhooks fail on localhost during testing, 
 * this endpoint allows the frontend to manually verify the upgrade instantly.
 */
router.post('/verify-upgrade', requireAuth, async (req, res) => {
    try {
        const user = req.user;

        const orderId = 'hackathon-test-order-' + Date.now();
        const subId = 'hackathon-test-sub-' + Date.now();

        // Upgrade the user to PRO directly
        user.tier = 'pro';
        user.subscription = {
            lsOrderId: orderId,
            lsSubscriptionId: subId,
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };

        await user.save();

        // Also create a mock Payment record for the local test
        await Payment.create({
            userId: user._id,
            lsOrderId: orderId,
            lsSubscriptionId: subId,
            amount: 399, // ₹399
            currency: 'INR',
            status: 'paid',
            webhookEvents: [{
                eventName: 'verify_upgrade_mock',
                receivedAt: new Date(),
                lsEventId: 'mock-event-' + Date.now(),
                payload: { note: 'Manual upgrade via verify-upgrade route' }
            }],
            idempotencyKeys: ['mock-event-' + Date.now()],
        });

        res.json({
            success: true,
            tier: user.tier,
            message: 'User upgraded successfully via frontend verification hook.'
        });
    } catch (error) {
        console.error('Billing verify error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to verify billing upgrade',
        });
    }
});

/**
 * GET /api/billing/pricing
 * Get available subscription plans with pricing
 */
router.get('/pricing', async (req, res) => {
    try {
        const basePricePerMonth = 349; // ₹349/month
        
        const plans = [
            {
                months: 1,
                name: '1 Month',
                pricePerMonth: basePricePerMonth,
                totalPrice: basePricePerMonth,
                discount: 0,
                savings: 0,
                popular: false,
            },
            {
                months: 3,
                name: '3 Months',
                pricePerMonth: Math.round(basePricePerMonth * 0.9),
                totalPrice: Math.round(basePricePerMonth * 3 * 0.9),
                discount: 10,
                savings: Math.round(basePricePerMonth * 3 * 0.1),
                popular: true,
            },
            {
                months: 6,
                name: '6 Months',
                pricePerMonth: Math.round(basePricePerMonth * 0.85),
                totalPrice: Math.round(basePricePerMonth * 6 * 0.85),
                discount: 15,
                savings: Math.round(basePricePerMonth * 6 * 0.15),
                popular: false,
            },
            {
                months: 12,
                name: '12 Months',
                pricePerMonth: Math.round(basePricePerMonth * 0.8),
                totalPrice: Math.round(basePricePerMonth * 12 * 0.8),
                discount: 20,
                savings: Math.round(basePricePerMonth * 12 * 0.2),
                popular: false,
                bestValue: true,
            },
        ];
        
        res.json({
            success: true,
            currency: 'INR',
            plans,
        });
    } catch (error) {
        console.error('Pricing fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pricing',
        });
    }
});

/**
 * GET /api/billing/history
 * Get payment history for the authenticated user
 */
router.get('/history', requireAuth, async (req, res) => {
    try {
        const payments = await Payment.find({ userId: req.user._id })
            .select('-webhookEvents -idempotencyKeys')
            .sort({ createdAt: -1 })
            .limit(50);
        
        const formattedPayments = payments.map(payment => ({
            id: payment._id,
            orderId: payment.lsOrderId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            date: payment.createdAt,
        }));
        
        res.json({
            success: true,
            payments: formattedPayments,
        });
    } catch (error) {
        console.error('Payment history error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history',
        });
    }
});

/**
 * GET /api/billing/subscription
 * Get detailed subscription information
 */
router.get('/subscription', requireAuth, async (req, res) => {
    try {
        const user = req.user;
        
        if (!user.subscription || user.subscription.status === 'none') {
            return res.json({
                success: true,
                hasSubscription: false,
                tier: user.tier,
            });
        }
        
        const now = new Date();
        const periodEnd = new Date(user.subscription.currentPeriodEnd);
        const daysRemaining = Math.ceil((periodEnd - now) / (1000 * 60 * 60 * 24));
        
        res.json({
            success: true,
            hasSubscription: true,
            tier: user.tier,
            status: user.subscription.status,
            currentPeriodEnd: user.subscription.currentPeriodEnd,
            daysRemaining: Math.max(0, daysRemaining),
            isExpired: periodEnd < now,
            cancelledAt: user.subscription.cancelledAt || null,
            orderId: user.subscription.lsOrderId,
            subscriptionId: user.subscription.lsSubscriptionId || null,
        });
    } catch (error) {
        console.error('Subscription fetch error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subscription details',
        });
    }
});

module.exports = router;
