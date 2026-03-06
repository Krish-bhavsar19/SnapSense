const {
    createCheckout,
    getSubscription,
    cancelSubscription,
} = require('@lemonsqueezy/lemonsqueezy.js');

/**
 * Create a checkout session for a user to upgrade to PRO
 * @param {Object} user - Mongoose user document
 * @returns {Promise<string>} - Checkout URL
 */
async function createCheckoutSession(user) {
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!storeId || !variantId) {
        throw new Error('Lemon Squeezy store or variant ID not configured');
    }

    try {
        const checkout = await createCheckout(storeId, variantId, {
            checkoutOptions: {
                embed: true,
                media: false,
                logo: true,
            },
            checkoutData: {
                email: user.email,
                name: user.name,
                custom: {
                    user_id: user._id.toString(),
                },
            },
            expiresAt: null,
            preview: true, // Set to false in production
            testMode: true, // Set to false in production
            productOptions: {
                redirectUrl: `${process.env.CLIENT_URL}/dashboard?upgraded=true`,
            }
        });

        if (!checkout.data?.data?.attributes?.url) {
            throw new Error('Invalid checkout response from Lemon Squeezy');
        }

        return checkout.data.data.attributes.url;
    } catch (error) {
        console.error('Lemon Squeezy createCheckout error:', error);
        throw new Error('Failed to create checkout session');
    }
}

/**
 * Get subscription details from Lemon Squeezy
 * @param {string} subscriptionId - LS subscription ID
 * @returns {Promise<Object>} - Subscription attributes
 */
async function getSubscriptionDetails(subscriptionId) {
    try {
        const subscription = await getSubscription(subscriptionId);
        return subscription.data?.data?.attributes || null;
    } catch (error) {
        console.error('Lemon Squeezy getSubscription error:', error);
        throw new Error('Failed to fetch subscription details');
    }
}

/**
 * Cancel a user's subscription
 * @param {string} subscriptionId - LS subscription ID
 * @returns {Promise<Object>} - Cancellation result
 */
async function cancelUserSubscription(subscriptionId) {
    try {
        const result = await cancelSubscription(subscriptionId);
        return result.data?.data?.attributes || null;
    } catch (error) {
        console.error('Lemon Squeezy cancelSubscription error:', error);
        throw new Error('Failed to cancel subscription');
    }
}

module.exports = {
    createCheckoutSession,
    getSubscriptionDetails,
    cancelUserSubscription,
};
