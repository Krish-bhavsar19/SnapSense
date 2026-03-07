const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const Payment = require('../models/Payment');

/**
 * POST /api/webhook/lemonsqueezy
 * Handle all Lemon Squeezy webhook events
 * 
 * CRITICAL: This route must use express.raw() middleware
 * Register in index.js BEFORE express.json():
 *   app.use('/api/webhook/lemonsqueezy', express.raw({ type: 'application/json' }))
 */
router.post('/lemonsqueezy', async (req, res) => {
    // STEP 1: Signature Verification
    const signature = req.headers['x-signature'];
    const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

    if (!secret) {
        console.error('❌ LEMONSQUEEZY_WEBHOOK_SECRET not configured');
        return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    if (!signature) {
        console.error('❌ Missing x-signature header');
        return res.status(401).json({ error: 'Missing signature' });
    }

    try {
        // Compute HMAC-SHA256 of raw body
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(req.body);
        const digest = hmac.digest('hex');

        // Timing-safe comparison
        const isValid = crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(digest)
        );

        if (!isValid) {
            console.error('❌ Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log('✅ Webhook signature verified');
    } catch (error) {
        console.error('❌ Signature verification error:', error);
        return res.status(401).json({ error: 'Invalid signature' });
    }

    // Parse the event
    let event;
    try {
        event = JSON.parse(req.body.toString());
    } catch (error) {
        console.error('❌ Failed to parse webhook body:', error);
        return res.status(400).json({ error: 'Invalid JSON' });
    }

    // STEP 2: Idempotency Check
    // Lemon Squeezy meta contains: event_name, webhook_id, custom_data (no event_id)
    // Use combination of webhook_id + event_name + data.id for idempotency
    const eventName = event.meta?.event_name;
    const userId = event.meta?.custom_data?.user_id;
    const eventId = `${event.meta?.webhook_id || 'unknown'}_${eventName}_${event.data?.id}`;

    if (!eventName) {
        console.error('❌ Missing event_name in webhook');
        return res.status(400).json({ error: 'Missing event_name' });
    }

    console.log(`📨 Webhook received: ${eventName} (Event ID: ${eventId})`);

    try {
        // Check if we've already processed this event
        const existingPayment = await Payment.findOne({
            idempotencyKeys: eventId,
        });

        if (existingPayment) {
            console.log(`⏭️  Event ${eventId} already processed, skipping`);
            return res.status(200).json({ received: true, skipped: true });
        }

        // STEP 3: Event Handling
        await handleWebhookEvent(event, eventName, eventId, userId);

        // STEP 4: Always return 200
        return res.status(200).json({ received: true });
    } catch (error) {
        // Log error but still return 200 to prevent retries
        console.error('❌ Webhook processing error:', error);
        return res.status(200).json({ received: true, error: error.message });
    }
});

/**
 * Process webhook events and update user/payment records
 */
async function handleWebhookEvent(event, eventName, eventId, userId) {
    const eventData = event.data;
    const attributes = eventData?.attributes || {};

    switch (eventName) {
        case 'order_created':
            console.log(`💰 Processing order_created for user ${userId}`);
            
            if (!userId) {
                console.error('❌ No user_id in order_created event');
                break;
            }

            const user = await User.findById(userId);
            if (!user) {
                console.error(`❌ User ${userId} not found`);
                break;
            }

            // Get months from custom data (default to 1 if not specified)
            const months = parseInt(event.meta?.custom_data?.months) || 1;
            console.log(`📅 Processing ${months}-month subscription`);

            // Check if user already has an active subscription (prevent double payment)
            if (user.subscription?.status === 'active' && user.subscription?.currentPeriodEnd > new Date()) {
                console.log(`⚠️  User ${userId} already has active subscription, extending instead`);
                // Extend existing subscription by the purchased months
                const currentEnd = new Date(user.subscription.currentPeriodEnd);
                const daysToAdd = months * 30;
                user.subscription.currentPeriodEnd = new Date(currentEnd.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
            } else {
                // Calculate proper expiry date based on purchased months
                const expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + (months * 30));
                
                // Upgrade user to PRO
                user.tier = 'pro';
                user.subscription = {
                    lsOrderId: eventData.id,
                    status: 'active',
                    currentPeriodEnd: expiryDate,
                };
            }
            
            await user.save();
            console.log(`✅ User ${userId} upgraded to PRO (expires: ${user.subscription.currentPeriodEnd})`);

            // Create/update Payment record
            await Payment.findOneAndUpdate(
                { lsOrderId: eventData.id },
                {
                    userId: user._id,
                    lsOrderId: eventData.id,
                    amount: attributes.total,
                    currency: attributes.currency,
                    status: 'paid',
                    $push: {
                        webhookEvents: {
                            eventName,
                            receivedAt: new Date(),
                            lsEventId: eventId,
                            payload: event,
                        },
                        idempotencyKeys: eventId,
                    },
                },
                { upsert: true, new: true }
            );
            break;

        case 'subscription_created':
            console.log(`📋 Processing subscription_created for user ${userId}`);
            
            if (!userId) break;

            const subUser = await User.findById(userId);
            if (!subUser) break;

            subUser.subscription = subUser.subscription || {};
            subUser.subscription.lsSubscriptionId = eventData.id;
            subUser.subscription.status = 'active';
            subUser.subscription.currentPeriodEnd = new Date(attributes.renews_at);
            await subUser.save();
            console.log(`✅ Subscription ${eventData.id} linked to user ${userId}`);

            // Update Payment record
            const payment = await Payment.findOne({ lsOrderId: attributes.order_id });
            if (payment) {
                payment.lsSubscriptionId = eventData.id;
                payment.webhookEvents.push({
                    eventName,
                    receivedAt: new Date(),
                    lsEventId: eventId,
                    payload: event,
                });
                payment.idempotencyKeys.push(eventId);
                await payment.save();
            }
            break;

        case 'subscription_updated':
            console.log(`🔄 Processing subscription_updated: ${eventData.id}`);
            
            const updatedSub = await User.findOne({
                'subscription.lsSubscriptionId': eventData.id,
            });

            if (updatedSub) {
                updatedSub.subscription.status = attributes.status === 'active' ? 'active' : attributes.status;
                updatedSub.subscription.currentPeriodEnd = new Date(attributes.renews_at);
                await updatedSub.save();
                console.log(`✅ Subscription ${eventData.id} updated`);
            }

            await recordEventInPayment(eventData.id, eventName, eventId, event);
            break;

        case 'subscription_payment_success':
            console.log(`✅ Processing subscription_payment_success for user ${userId}`);
            
            const renewUser = await User.findOne({
                'subscription.lsSubscriptionId': eventData.id,
            });

            if (renewUser) {
                renewUser.tier = 'pro';
                renewUser.subscription.status = 'active';
                renewUser.subscription.currentPeriodEnd = new Date(attributes.renews_at);
                await renewUser.save();
                console.log(`✅ User ${renewUser._id} subscription renewed`);
            }

            await recordEventInPayment(eventData.id, eventName, eventId, event);
            break;

        case 'subscription_payment_failed':
            console.error(`❌ Processing subscription_payment_failed for subscription ${eventData.id}`);
            
            const failedUser = await User.findOne({
                'subscription.lsSubscriptionId': eventData.id,
            });

            if (failedUser) {
                failedUser.tier = 'free';
                failedUser.subscription.status = 'payment_failed';
                await failedUser.save();
                console.log(`⚠️  User ${failedUser._id} downgraded to free due to payment failure`);
            }

            await recordEventInPayment(eventData.id, eventName, eventId, event);
            break;

        case 'subscription_cancelled':
            console.log(`🛑 Processing subscription_cancelled: ${eventData.id}`);
            
            // Grace period logic: User stays PRO until currentPeriodEnd
            // Do NOT downgrade tier immediately
            const cancelledUser = await User.findOne({
                'subscription.lsSubscriptionId': eventData.id,
            });

            if (cancelledUser) {
                cancelledUser.subscription.status = 'cancelled';
                cancelledUser.subscription.cancelledAt = new Date();
                await cancelledUser.save();
                console.log(`✅ Subscription cancelled but user keeps PRO until ${cancelledUser.subscription.currentPeriodEnd}`);
            }

            await recordEventInPayment(eventData.id, eventName, eventId, event);
            break;

        case 'subscription_resumed':
            console.log(`▶️  Processing subscription_resumed: ${eventData.id}`);
            
            const resumedUser = await User.findOne({
                'subscription.lsSubscriptionId': eventData.id,
            });

            if (resumedUser) {
                resumedUser.tier = 'pro';
                resumedUser.subscription.status = 'active';
                resumedUser.subscription.currentPeriodEnd = new Date(attributes.renews_at);
                resumedUser.subscription.cancelledAt = null;
                await resumedUser.save();
                console.log(`✅ User ${resumedUser._id} subscription resumed`);
            }

            await recordEventInPayment(eventData.id, eventName, eventId, event);
            break;

        case 'subscription_expired':
            console.log(`⏰ Processing subscription_expired: ${eventData.id}`);
            
            const expiredUser = await User.findOne({
                'subscription.lsSubscriptionId': eventData.id,
            });

            if (expiredUser) {
                expiredUser.tier = 'free';
                expiredUser.subscription.status = 'expired';
                await expiredUser.save();
                console.log(`✅ User ${expiredUser._id} downgraded to free (subscription expired)`);
            }

            await recordEventInPayment(eventData.id, eventName, eventId, event);
            break;

        case 'order_refunded':
            console.log(`💸 Processing order_refunded for order ${eventData.id}`);
            
            // Find user by order ID
            const refundedUser = await User.findOne({
                'subscription.lsOrderId': eventData.id,
            });

            if (refundedUser) {
                // Downgrade user to free immediately on refund
                refundedUser.tier = 'free';
                refundedUser.subscription.status = 'refunded';
                await refundedUser.save();
                console.log(`✅ User ${refundedUser._id} downgraded to free (payment refunded)`);
            }

            // Update payment record status
            await Payment.findOneAndUpdate(
                { lsOrderId: eventData.id },
                {
                    status: 'refunded',
                    $push: {
                        webhookEvents: {
                            eventName,
                            receivedAt: new Date(),
                            lsEventId: eventId,
                            payload: event,
                        },
                        idempotencyKeys: eventId,
                    },
                }
            );
            break;

        default:
            console.log(`⚠️  Unhandled event type: ${eventName}`);
    }
}

/**
 * Helper: Record webhook event in Payment document
 */
async function recordEventInPayment(lsSubscriptionId, eventName, eventId, event) {
    const payment = await Payment.findOne({ lsSubscriptionId });
    
    if (payment) {
        payment.webhookEvents.push({
            eventName,
            receivedAt: new Date(),
            lsEventId: eventId,
            payload: event,
        });
        payment.idempotencyKeys.push(eventId);
        await payment.save();
    }
}

/**
 * POST /api/webhook/test-upgrade
 * Manual endpoint to test upgrading a user to PRO (for development)
 * Send: { "userId": "your_user_id" }
 */
router.post('/test-upgrade', async (req, res) => {
    try {
        const { userId } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'userId required' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Manually upgrade user to PRO
        user.tier = 'pro';
        user.subscription = {
            lsOrderId: 'test-order-' + Date.now(),
            lsSubscriptionId: 'test-sub-' + Date.now(),
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        };
        await user.save();

        console.log(`✅ TEST: User ${userId} manually upgraded to PRO`);

        return res.json({
            success: true,
            message: 'User upgraded to PRO (test mode)',
            user: {
                email: user.email,
                tier: user.tier,
                subscription: user.subscription,
            },
        });
    } catch (error) {
        console.error('❌ Test upgrade error:', error);
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
