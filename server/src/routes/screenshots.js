const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { checkUploadLimit } = require('../middleware/tierCheck');
const { classifyScreenshot } = require('../services/groqService');
const { uploadFileToDrive, deleteFileFromDrive } = require('../services/driveService');
const { appendRow, appendQuoteRow, appendTransactionRow, appendLocationRow, deleteSheetRow } = require('../services/sheetsService');
const {
    createCalendarEvent,
    shouldCreateCalendarEvent,
    deleteCalendarEvent,
} = require('../services/calendarService');
const {
    createGoogleTask,
    shouldCreateGoogleTask,
} = require('../services/googleTasks');
const Screenshot = require('../models/Screenshot');
const AnonymousSession = require('../models/AnonymousSession');
const Action = require('../models/Action');
const User = require('../models/User');

// Multer: in-memory storage (no disk writes)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});

/**
 * Shared helper: executes all Google API actions for a given user + image + AI result.
 * Returns { driveResult, calendarEventId, calendarEventLink, taskId, taskLink, sheetsRowNumber }
 */
async function executeGoogleActions(user, buffer, filename, mimetype, aiResult) {
    // Step A: Upload to Google Drive
    console.log('☁️  Uploading to Drive...');
    const driveResult = await uploadFileToDrive(user, buffer, filename, mimetype, aiResult.category);
    console.log(`✅ Drive: ${driveResult.webViewLink}`);

    // Step B: Create Calendar Event (if needed)
    let calendarEventId = null;
    let calendarEventLink = null;
    if (shouldCreateCalendarEvent(aiResult.category, aiResult.suggestedAction)) {
        try {
            console.log('📅 Creating calendar event...');
            const calResult = await createCalendarEvent(user, {
                summary: aiResult.summary,
                description: `Screenshot classified as: ${aiResult.category}`,
                date: aiResult.date,
                category: aiResult.category,
            });
            calendarEventId = calResult.eventId;
            calendarEventLink = calResult.eventLink;
            console.log(`✅ Calendar event: ${calendarEventLink}`);
        } catch (calErr) {
            console.error('⚠️  Calendar event failed (non-critical):', calErr.message);
        }
    }

    // Step C: Create Google Task (if needed)
    let taskId = null;
    let taskLink = null;
    if (shouldCreateGoogleTask(aiResult.category, aiResult.suggestedAction)) {
        try {
            console.log('📝 Creating Google Task...');
            const taskRes = await createGoogleTask(user, {
                title: aiResult.summary,
                notes: `Category: ${aiResult.category}\nDate: ${aiResult.date || 'None'}`,
                due: aiResult.date,
            });
            taskId = taskRes.taskId;
            taskLink = taskRes.taskLink;
            console.log(`✅ Google Task created`);
        } catch (taskErr) {
            console.error('⚠️  Google Task failed (non-critical):', taskErr.message);
        }
    }

    // Step D: Log to Google Sheets (if needed)
    let sheetsRowNumber = null;
    const autoSheetCategories = ['Payment', 'Quote', 'Location'];
    if (aiResult.suggestedAction === 'sheet' || autoSheetCategories.includes(aiResult.category)) {
        try {
            console.log('📊 Logging to Sheets...');
            let appendFn = appendRow;
            if (aiResult.category === 'Quote') appendFn = appendQuoteRow;
            else if (aiResult.category === 'Payment') appendFn = appendTransactionRow;
            else if (aiResult.category === 'Location') appendFn = appendLocationRow;

            sheetsRowNumber = await appendFn(user, {
                timestamp: new Date().toISOString(),
                category: aiResult.category,
                summary: aiResult.summary,
                dateDetected: aiResult.date || '',
                actionTaken: calendarEventLink ? 'Calendar event created' : (taskLink ? 'Google Task created' : 'Stored in Sheets'),
                driveLink: driveResult.webViewLink,
                calendarEventLink: calendarEventLink || '',
                confidence: aiResult.confidence,
                locationCategory: aiResult.locationCategory || '',
                locationName: aiResult.locationName || '',
                mapLink: aiResult.mapLink || '',
                quoteAuthor: aiResult.quoteAuthor || '',
                quoteGenre: aiResult.quoteGenre || '',
                transactionType: aiResult.transactionType || '',
                transactionTime: aiResult.transactionTime || '',
                transactionAmount: aiResult.transactionAmount || '',
            });
            console.log(`✅ Sheet row added for ${aiResult.category}`);
        } catch (sheetErr) {
            console.error('⚠️  Sheets log failed (non-critical):', sheetErr.message);
        }
    }

    return { driveResult, calendarEventId, calendarEventLink, taskId, taskLink, sheetsRowNumber };
}

// ─── POST /api/screenshots/upload ────────────────────────────────────────────
router.post(
    '/upload',
    requireAuth,    checkUploadLimit,    upload.single('screenshot'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const user = await User.findById(req.user._id);
            const { buffer, mimetype, originalname } = req.file;
            const filename = `${Date.now()}-${originalname}`;

            // Check for duplicate file hash
            const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
            const existingScreenshot = await Screenshot.findOne({ userId: user._id, fileHash });
            
            if (existingScreenshot) {
                return res.status(409).json({ 
                    success: false, 
                    message: `You have already uploaded this screenshot. It was categorized as "${existingScreenshot.category}".` 
                });
            }

            // Step 1: Classify with Groq AI
            console.log('🤖 Classifying screenshot...');
            const aiResult = await classifyScreenshot(buffer, mimetype);
            console.log(`✅ Category: ${aiResult.category}`);

            // Step 2–4: Execute all Google Actions
            const { driveResult, calendarEventId, calendarEventLink, taskId, taskLink, sheetsRowNumber }
                = await executeGoogleActions(user, buffer, filename, mimetype, aiResult);

            // Step 5: Save to MongoDB
            const screenshot = await Screenshot.create({
                userId: user._id,
                originalName: originalname,
                mimeType: mimetype,
                fileHash,
                category: aiResult.category,
                metadata: {
                    summary: aiResult.summary,
                    date: aiResult.date,
                    suggestedAction: aiResult.suggestedAction,
                    confidence: aiResult.confidence,
                    locationCategory: aiResult.locationCategory || null,
                    locationName: aiResult.locationName || null,
                    mapLink: aiResult.mapLink || null,
                    quoteAuthor: aiResult.quoteAuthor || null,
                    quoteGenre: aiResult.quoteGenre || null,
                    transactionType: aiResult.transactionType || null,
                    transactionTime: aiResult.transactionTime || null,
                    transactionAmount: aiResult.transactionAmount || null,
                    rawAI: aiResult.rawAI,
                },
                driveFileId: driveResult.fileId,
                driveViewLink: driveResult.webViewLink,
                driveThumbnailLink: driveResult.thumbnailLink,
                calendarEventId,
                calendarEventLink,
                taskId,
                taskLink,
                sheetsRowNumber,
            });

            // Increment upload counters
            await User.findByIdAndUpdate(user._id, { 
                $inc: { 
                    totalUploads: 1,
                    screenshotCount: 1 // Increment for free tier limit tracking
                } 
            });

            return res.status(201).json({
                success: true,
                message: `Classified as "${aiResult.category}"`,
                screenshot: {
                    _id: screenshot._id,
                    category: screenshot.category,
                    metadata: screenshot.metadata,
                    driveViewLink: screenshot.driveViewLink,
                    driveThumbnailLink: screenshot.driveThumbnailLink,
                    calendarEventLink: screenshot.calendarEventLink,
                    taskLink: screenshot.taskLink,
                    createdAt: screenshot.createdAt,
                },
            });
        } catch (err) {
            console.error('❌ Upload error:', err);
            return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
        }
    }
);

// ─── POST /api/screenshots/upload/anonymous ───────────────────────────────────
// No auth required – classify screenshot and store as a pending Action
router.post(
    '/upload/anonymous',
    upload.single('screenshot'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'No file uploaded' });
            }

            const sessionId = req.headers['x-session-id'];
            if (!sessionId) {
                return res.status(400).json({ success: false, message: 'x-session-id header is required' });
            }

            const { buffer, mimetype, originalname } = req.file;

            // Check for duplicate anonymous file hash
            const fileHash = crypto.createHash('md5').update(buffer).digest('hex');
            const existingAction = await Action.findOne({ sessionId, fileHash });

            if (existingAction) {
                return res.status(409).json({
                    success: false,
                    message: `You have already uploaded this screenshot during this session (Classified as: ${existingAction.category}).`
                });
            }

            // Ensure AnonymousSession exists (upsert)
            await AnonymousSession.findOneAndUpdate(
                { sessionId },
                { sessionId },
                { upsert: true, new: true }
            );

            // ── Hard cap: max 3 uploads per anonymous session ──────────────────
            const ANON_UPLOAD_LIMIT = 3;
            const existingCount = await Action.countDocuments({ sessionId });
            if (existingCount >= ANON_UPLOAD_LIMIT) {
                return res.status(429).json({
                    success: false,
                    limitReached: true,
                    message: `Free preview limit reached (${ANON_UPLOAD_LIMIT} screenshots). Sign in with Google to unlock unlimited uploads!`,
                });
            }

            // Classify with Groq AI
            console.log('🤖 [Anonymous] Classifying screenshot...');
            const aiResult = await classifyScreenshot(buffer, mimetype);
            console.log(`✅ [Anonymous] Category: ${aiResult.category}`);

            // Save as pending Action with the image buffer
            const action = await Action.create({
                sessionId,
                originalName: originalname,
                mimeType: mimetype,
                fileHash,
                imageBuffer: buffer,
                category: aiResult.category,
                metadata: {
                    summary: aiResult.summary,
                    date: aiResult.date,
                    suggestedAction: aiResult.suggestedAction,
                    confidence: aiResult.confidence,
                    locationCategory: aiResult.locationCategory || null,
                    locationName: aiResult.locationName || null,
                    mapLink: aiResult.mapLink || null,
                    quoteAuthor: aiResult.quoteAuthor || null,
                    quoteGenre: aiResult.quoteGenre || null,
                    transactionType: aiResult.transactionType || null,
                    transactionTime: aiResult.transactionTime || null,
                    transactionAmount: aiResult.transactionAmount || null,
                    rawAI: aiResult.rawAI,
                },
                status: 'pending',
            });

            return res.status(201).json({
                success: true,
                message: `Classified as "${aiResult.category}". Log in to save to your Google account.`,
                actionCard: {
                    actionId: action._id,
                    category: aiResult.category,
                    summary: aiResult.summary,
                    date: aiResult.date,
                    suggestedAction: aiResult.suggestedAction,
                    confidence: aiResult.confidence,
                    locationName: aiResult.locationName,
                    mapLink: aiResult.mapLink,
                    quoteAuthor: aiResult.quoteAuthor,
                    transactionAmount: aiResult.transactionAmount,
                    transactionType: aiResult.transactionType,
                },
            });
        } catch (err) {
            console.error('❌ Anonymous upload error:', err);
            return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
        }
    }
);


// ─── GET /api/screenshots — All screenshots for user ─────────────────────────
router.get('/', requireAuth, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const [screenshots, total] = await Promise.all([
            Screenshot.find({ userId: req.user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('-metadata.rawAI'),
            Screenshot.countDocuments({ userId: req.user._id }),
        ]);

        res.json({
            success: true,
            data: screenshots,
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/screenshots/category/:cat ──────────────────────────────────────
router.get('/category/:cat', requireAuth, async (req, res) => {
    try {
        const category = decodeURIComponent(req.params.cat);
        const screenshots = await Screenshot.find({
            userId: req.user._id,
            category,
        })
            .sort({ createdAt: -1 })
            .select('-metadata.rawAI');

        res.json({ success: true, category, data: screenshots });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── GET /api/screenshots/stats ──────────────────────────────────────────────
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const stats = await Screenshot.aggregate([
            { $match: { userId: req.user._id } },
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        const total = stats.reduce((sum, s) => sum + s.count, 0);

        res.json({
            success: true,
            total,
            byCategory: stats.map((s) => ({ category: s._id, count: s.count })),
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ─── DELETE /api/screenshots/:id ─────────────────────────────────────────────
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const screenshot = await Screenshot.findOne({
            _id: req.params.id,
            userId: req.user._id,
        });

        if (!screenshot) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }

        const user = await User.findById(req.user._id);

        // ── Cascade: Delete from Google Drive ──────────────────────────────
        if (screenshot.driveFileId) {
            try {
                await deleteFileFromDrive(user, screenshot.driveFileId);
            } catch (err) {
                console.error('⚠️  Drive delete failed (non-critical):', err.message);
            }
        }

        // ── Cascade: Delete from Google Calendar ───────────────────────────
        if (screenshot.calendarEventId) {
            try {
                await deleteCalendarEvent(user, screenshot.calendarEventId);
            } catch (err) {
                console.error('⚠️  Calendar delete failed (non-critical):', err.message);
            }
        }

        // ── Cascade: Delete row from Google Sheets ─────────────────────────
        if (screenshot.sheetsRowNumber) {
            // Determine which sheet tab this screenshot was logged to
            const category = screenshot.category;
            let sheetName = 'Screenshots';
            if (category === 'Quote') sheetName = 'Quotes';
            else if (category === 'Payment') sheetName = 'Transactions';
            else if (category === 'Location') sheetName = 'Locations';

            try {
                await deleteSheetRow(user, screenshot.sheetsRowNumber, sheetName);
            } catch (err) {
                console.error('⚠️  Sheets row delete failed (non-critical):', err.message);
            }
        }

        // ── Remove from MongoDB ────────────────────────────────────────────
        await screenshot.deleteOne();

        // Decrement screenshot count (prevent negative values)
        const currentCount = user.screenshotCount || 0;
        const currentTotal = user.totalUploads || 0;
        
        await User.findByIdAndUpdate(user._id, {
            $set: { 
                screenshotCount: Math.max(0, currentCount - 1),
                totalUploads: Math.max(0, currentTotal - 1)
            },
        });

        res.json({ success: true, message: 'Screenshot deleted from all locations' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
