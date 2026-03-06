const express = require('express');
const passport = require('passport');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { uploadFileToDrive } = require('../services/driveService');
const { appendRow, appendQuoteRow, appendTransactionRow, appendLocationRow } = require('../services/sheetsService');
const { createCalendarEvent, shouldCreateCalendarEvent } = require('../services/calendarService');
const { createGoogleTask, shouldCreateGoogleTask } = require('../services/googleTasks');
const Screenshot = require('../models/Screenshot');
const AnonymousSession = require('../models/AnonymousSession');
const Action = require('../models/Action');
const User = require('../models/User');

// ─── Initiate Google OAuth ────────────────────────────────────────────────────
// Requests ALL scopes at login time
router.get(
    '/google',
    passport.authenticate('google', {
        scope: [
            'profile',
            'email',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/tasks',
        ],
        accessType: 'offline',
        prompt: 'consent', // Forces refresh token to be returned
    })
);

// ─── Google OAuth Callback ────────────────────────────────────────────────────
router.get(
    '/google/callback',
    passport.authenticate('google', {
        failureRedirect: `${process.env.CLIENT_URL}/login?error=auth_failed`,
    }),
    (req, res) => {
        // Successful authentication
        res.redirect(`${process.env.CLIENT_URL}/dashboard`);
    }
);

// ─── Logout ───────────────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ success: false, message: 'Logout failed' });
        }
        req.session.destroy((err2) => {
            res.clearCookie('connect.sid');
            res.json({ success: true, message: 'Logged out successfully' });
        });
    });
});

// ─── Get Current User ─────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, user: null });
    }
    // Don't send tokens to frontend
    const { googleId, accessToken, refreshToken, __v, ...safeUser } =
        req.user.toObject();
    res.json({ success: true, user: safeUser });
});

// ─── Merge Anonymous Session Actions ─────────────────────────────────────────
// POST /api/auth/merge
// Authenticated users send their anonymous sessionId to execute all pending Actions
router.post('/merge', requireAuth, async (req, res) => {
    const { sessionId, pendingCards } = req.body;
    if (!sessionId) {
        return res.status(400).json({ success: false, message: 'sessionId is required' });
    }

    try {
        const user = await User.findById(req.user._id);
        
        // Find all pending actions for this session
        const pendingActions = await Action.find({ sessionId, status: 'pending' });

        if (pendingActions.length === 0) {
            return res.json({ success: true, message: 'No pending actions on server to merge', merged: 0 });
        }

        const results = [];

        // Match server actions with client-side verified cards
        for (const action of pendingActions) {
            try {
                // Atomic claim: only proceed if the action is still pending
                const claimedAction = await Action.findOneAndUpdate(
                    { _id: action._id, status: 'pending' },
                    { status: 'completed' }, // Pre-emptively mark as completed to prevent double processing
                    { new: true }
                );

                if (!claimedAction) {
                    console.log(`⏭️ [Merge] Action ${action._id} already processed, skipping.`);
                    continue;
                }

                // Determine the correct metadata to use
                // If the client sent verified cards, find the one that matches this action
                let finalMetadata = action.metadata;

                if (pendingCards && Array.isArray(pendingCards)) {
                    const matchedCard = pendingCards.find(c => 
                        (c.actionId && c.actionId.toString() === action._id.toString()) ||
                        (c.summary === action.metadata.summary && c.category === action.category)
                    );
                    if (matchedCard) {
                        console.log(`✅ [Merge] Verified action ${action._id} against client card`);
                        finalMetadata = { ...action.metadata, ...matchedCard };
                    }
                }

                const aiResult = finalMetadata;

                const filename = `${Date.now()}-${action.originalName}`;

                // Upload to Drive
                const driveResult = await uploadFileToDrive(
                    user, action.imageBuffer, filename, action.mimeType, action.category
                );

                // Create Calendar Event (if needed)
                let calendarEventId = null, calendarEventLink = null;
                if (shouldCreateCalendarEvent(action.category, aiResult.suggestedAction)) {
                    try {
                        const calResult = await createCalendarEvent(user, {
                            summary: aiResult.summary,
                            description: `Merged from anonymous session`,
                            date: aiResult.date,
                            category: action.category,
                        });
                        calendarEventId = calResult.eventId;
                        calendarEventLink = calResult.eventLink;
                    } catch (e) { console.error('⚠️  Calendar merge failed:', e.message); }
                }

                // Create Google Task (if needed)
                let taskId = null, taskLink = null;
                if (shouldCreateGoogleTask(action.category, aiResult.suggestedAction)) {
                    try {
                        const taskRes = await createGoogleTask(user, {
                            title: aiResult.summary,
                            notes: `Category: ${action.category}\nMerged from anonymous session`,
                            due: aiResult.date,
                        });
                        taskId = taskRes.taskId;
                        taskLink = taskRes.taskLink;
                    } catch (e) { console.error('⚠️  Task merge failed:', e.message); }
                }

                // Log to Google Sheets (if needed)
                let sheetsRowNumber = null;
                const autoSheetCategories = ['Payment', 'Quote', 'Location'];
                if (aiResult.suggestedAction === 'sheet' || autoSheetCategories.includes(action.category)) {
                    try {
                        let appendFn = appendRow;
                        if (action.category === 'Quote') appendFn = appendQuoteRow;
                        else if (action.category === 'Payment') appendFn = appendTransactionRow;
                        else if (action.category === 'Location') appendFn = appendLocationRow;

                        sheetsRowNumber = await appendFn(user, {
                            timestamp: new Date().toISOString(),
                            category: action.category,
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
                    } catch (e) { console.error('⚠️  Sheets merge failed:', e.message); }
                }

                // Create permanent Screenshot document
                const screenshot = await Screenshot.create({
                    userId: user._id,
                    originalName: action.originalName,
                    mimeType: action.mimeType,
                    category: action.category,
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

                // Update the claimed action with the reference to the new permanent screenshot
                claimedAction.screenshotId = screenshot._id;
                claimedAction.imageBuffer = undefined; // Clear the heavy buffer
                await claimedAction.save();

                results.push({ actionId: claimedAction._id, screenshotId: screenshot._id, status: 'completed' });
            } catch (actionErr) {
                console.error(`❌ Failed to merge action ${action._id}:`, actionErr.message);
                // If it fails after claiming, we mark it as failed so it doesn't get stuck in 'completed' incorrectly
                await Action.findByIdAndUpdate(action._id, { status: 'failed' });
                results.push({ actionId: action._id, status: 'failed', error: actionErr.message });
            }
        }


        // Clean up the AnonymousSession
        await AnonymousSession.deleteOne({ sessionId });
        await User.findByIdAndUpdate(user._id, { $inc: { totalUploads: results.filter(r => r.status === 'completed').length } });

        return res.json({
            success: true,
            message: `Merged ${results.filter(r => r.status === 'completed').length} of ${pendingActions.length} pending actions.`,
            merged: results.filter(r => r.status === 'completed').length,
            results,
        });
    } catch (err) {
        console.error('❌ Merge error:', err);
        return res.status(500).json({ success: false, message: err.message || 'Internal server error' });
    }
});


module.exports = router;

