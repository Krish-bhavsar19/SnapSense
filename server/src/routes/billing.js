const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { createCheckoutSession } = require('../services/lemonSqueezyService');

/**
 * POST /api/billing/checkout
 * Create a checkout session for the authenticated user
 */
router.post('/checkout', requireAuth, async (req, res) => {
    try {
        const checkoutUrl = await createCheckoutSession(req.user);
        
        res.json({
            success: true,
            checkoutUrl,
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
        
        // Upgrade the user to PRO directly
        user.tier = 'pro';
        user.subscription = {
            lsOrderId: 'hackathon-test-order-' + Date.now(),
            lsSubscriptionId: 'hackathon-test-sub-' + Date.now(),
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };
        
        await user.save();
        
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

module.exports = router;
