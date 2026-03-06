const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        lsOrderId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        lsSubscriptionId: {
            type: String,
            default: null,
        },
        amount: {
            type: Number,
            required: true,
        },
        currency: {
            type: String,
            default: 'INR',
        },
        status: {
            type: String,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending',
        },
        webhookEvents: [
            {
                eventName: String,
                receivedAt: Date,
                lsEventId: String,
                payload: mongoose.Schema.Types.Mixed,
            },
        ],
        idempotencyKeys: {
            type: [String],
            default: [],
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
