/**
 * Middleware to check if subscription has expired and downgrade user
 * Should be applied after authentication middleware
 */
const checkSubscriptionExpiry = async (req, res, next) => {
    if (!req.user) {
        return next();
    }

    const user = req.user;
    
    // Check if user has PRO tier with subscription
    if (user.tier === 'pro' && user.subscription) {
        const now = new Date();
        const periodEnd = new Date(user.subscription.currentPeriodEnd);
        
        // If subscription has expired and status is not already expired
        if (periodEnd < now && user.subscription.status !== 'expired') {
            console.log(`⏰ Subscription expired for user ${user._id}, downgrading to free`);
            
            user.tier = 'free';
            user.subscription.status = 'expired';
            await user.save();
            
            // Update req.user to reflect the change
            req.user = user;
        }
    }
    
    next();
};

/**
 * Middleware to require PRO tier for specific features
 */
const requirePro = (req, res, next) => {
    if (req.user && req.user.tier === 'pro') {
        return next();
    }

    return res.status(403).json({
        error: 'PRO_REQUIRED',
        feature: req.body.destination || 'This feature',
        message: 'This feature requires SnapSense Pro. Please upgrade to continue.',
    });
};

/**
 * Middleware to check upload limits for free tier users
 * Free tier: 10 screenshots/month, auto-resets every 30 days
 */
const checkUploadLimit = async (req, res, next) => {
    // PRO users have unlimited uploads
    if (req.user.tier === 'pro') {
        return next();
    }

    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    if (!user) return res.status(401).json({ error: 'USER_NOT_FOUND' });

    // Free tier logic
    const now = new Date();

    // Initialize countResetAt on first upload
    if (!user.countResetAt) {
        user.countResetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
        await user.save();
    }

    // Check if reset period has passed
    if (now > user.countResetAt) {
        user.screenshotCount = 0;
        user.countResetAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        await user.save();
    }

    // Check if limit reached
    if (user.screenshotCount >= 10) {
        return res.status(402).json({
            error: 'LIMIT_REACHED',
            used: user.screenshotCount,
            limit: 10,
            upgradeUrl: '/upgrade',
            message: 'You have reached your monthly limit of 10 screenshots. Upgrade to Pro for unlimited uploads.',
        });
    }

    // Allow upload - count will be incremented in the upload route
    next();
};

module.exports = { requirePro, checkUploadLimit, checkSubscriptionExpiry };
