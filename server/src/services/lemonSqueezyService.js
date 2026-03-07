const {
    createCheckout,
    getSubscription,
    cancelSubscription,
} = require('@lemonsqueezy/lemonsqueezy.js');

/**
 * Create a checkout session for a user to upgrade to PRO
 * @param {Object} user - Mongoose user document
 * @param {Number} months - Subscription duration in months (1, 3, 6, or 12)
 * @returns {Promise<string>} - Checkout URL
 */
async function createCheckoutSession(user, months = 1) {
    const storeId = process.env.LEMONSQUEEZY_STORE_ID;
    const variantId = process.env.LEMONSQUEEZY_VARIANT_ID;

    if (!storeId || !variantId) {
        throw new Error('Lemon Squeezy store or variant ID not configured');
    }

    // Calculate pricing with discounts
    // Base price: ₹349/month
    const basePricePerMonth = 349;
    const discounts = {
        1: 0,      // No discount
        3: 10,     // 10% discount
        6: 15,     // 15% discount
        12: 20,    // 20% discount
    };
    
    const discount = discounts[months] || 0;
    const totalPrice = Math.round(basePricePerMonth * months * (1 - discount / 100));
    
    console.log(`💰 Checkout pricing:`, {
        months,
        basePricePerMonth,
        discount: `${discount}%`,
        totalPrice: `₹${totalPrice}`,
        priceInPaise: totalPrice * 100
    });
    
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
                    months: months.toString(),
                    discount_applied: discount.toString(),
                },
            },
            expiresAt: null,
            preview: true, // Set to false in production
            testMode: true, // Set to false in production
            customPrice: totalPrice * 100, // Price in paise (smallest currency unit)
            productOptions: {
                name: `SnapSense Pro - ${months} Month${months > 1 ? 's' : ''}${discount > 0 ? ` (${discount}% OFF)` : ''}`,
                description: `${months} month${months > 1 ? 's' : ''} of unlimited screenshot storage and AI-powered organization`,
                redirectUrl: `${process.env.CLIENT_URL}/dashboard?upgraded=true&months=${months}`,
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
