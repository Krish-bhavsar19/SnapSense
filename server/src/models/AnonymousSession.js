const mongoose = require('mongoose');

const anonymousSessionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String,
            required: true,
            unique: true,
        },
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 86400, // Expires after 24 hours (86400 seconds)
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('AnonymousSession', anonymousSessionSchema);
