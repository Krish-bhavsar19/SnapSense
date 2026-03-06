const mongoose = require('mongoose');

const screenshotSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        originalName: { type: String, default: 'screenshot.png' },
        mimeType: { type: String, default: 'image/png' },

        // Classification
        category: {
            type: String,
            enum: [
                'Location',
                'Ticket',
                'Wallpaper',
                'LinkedIn Profile',
                'LinkedIn Post',
                'Social Media Post',
                'Payment',
                'Sensitive Document',
                'Contact',
                'Mail',
                'Quote',
                'WhatsApp Chat',
                'Study Notes',
                'Other',
            ],
            required: true,
        },

        // AI analysis
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

        // Google Drive
        driveFileId: { type: String, default: null },
        driveViewLink: { type: String, default: null },
        driveThumbnailLink: { type: String, default: null },

        // Google Calendar (for Tickets, Payments, Contacts)
        calendarEventId: { type: String, default: null },
        calendarEventLink: { type: String, default: null },

        // Google Tasks (for tasks, to-dos, study notes)
        taskId: { type: String, default: null },
        taskLink: { type: String, default: null },

        // Google Sheets row
        sheetsRowNumber: { type: Number, default: null },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Screenshot', screenshotSchema);
