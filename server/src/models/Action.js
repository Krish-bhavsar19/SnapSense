const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema(
    {
        sessionId: {
            type: String, // Links to AnonymousSession.sessionId
            required: true,
            index: true,
        },
        originalName: { type: String, default: 'screenshot.png' },
        mimeType: { type: String, default: 'image/png' },
        
        // Store image data temporarily until logged in and uploaded to Drive
        imageBuffer: { type: Buffer },

        
        // AI Classification
        category: {
            type: String,
            required: true,
        },
        metadata: {
            summary: { type: String, default: '' },
            date: { type: String, default: null },
            suggestedAction: { type: String, default: 'none' },
            confidence: { type: Number, default: 0 },
            locationCategory: { type: String, default: null },
            locationName: { type: String, default: null },
            mapLink: { type: String, default: null },
            quoteAuthor: { type: String, default: null },
            quoteGenre: { type: String, default: null },
            transactionType: { type: String, default: null },
            transactionTime: { type: String, default: null },
            transactionAmount: { type: String, default: null },
            rawAI: { type: String, default: '' },
        },
        
        status: {
            type: String,
            enum: ['pending', 'completed', 'failed'],
            default: 'pending',
        },
        
        // When merged, point to the permanent Screenshot document
        screenshotId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Screenshot',
            default: null,
        },
    },
    { 
        timestamps: true,
        // Automatically delete pending actions after 24 hours
        expires: 86400 // 24 hours
    }
);


module.exports = mongoose.model('Action', actionSchema);
