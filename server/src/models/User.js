const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
    {
        googleId: { type: String, required: true, unique: true },
        email: { type: String, required: true },
        name: { type: String, required: true },
        picture: { type: String, default: '' },

        // Google OAuth tokens
        accessToken: { type: String, default: '' },
        refreshToken: { type: String, default: '' },

        // Google resource IDs (created on first use)
        driveRootFolderId: { type: String, default: null },
        driveCategoryFolders: {
            type: Map,
            of: String,
            default: {},
        },
        sheetsId: { type: String, default: null },

        // App data & Limits (From SRS)
        tier: { type: String, enum: ['free', 'pro'], default: 'free' },
        screenshotCount: { type: Number, default: 0 },
        countResetAt: { type: Date, default: null },
        totalUploads: { type: Number, default: 0 }, // Keeping this as it's used in current /upload route

        // Subscription Details (Lemon Squeezy Integration)
        subscription: {
            lsOrderId: String,
            lsSubscriptionId: String,
            status: {
                type: String,
                enum: ['none', 'active', 'payment_failed', 'cancelled', 'expired'],
                default: 'none',
            },
            currentPeriodEnd: Date,
            cancelledAt: Date,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
