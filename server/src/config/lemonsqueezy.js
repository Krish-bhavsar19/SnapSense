const { lemonSqueezySetup } = require('@lemonsqueezy/lemonsqueezy.js');

/**
 * Initialize Lemon Squeezy SDK with API key from environment
 * Call this once at app startup
 */
function initializeLemonSqueezy() {
    const apiKey = process.env.LEMONSQUEEZY_API_KEY;
    
    if (!apiKey) {
        console.warn('⚠️  LEMONSQUEEZY_API_KEY not found in environment variables');
        return;
    }
    
    lemonSqueezySetup({
        apiKey,
        onError: (error) => {
            console.error('❌ Lemon Squeezy API Error:', error);
        },
    });
    
    console.log('✅ Lemon Squeezy SDK initialized');
}

module.exports = { initializeLemonSqueezy };
