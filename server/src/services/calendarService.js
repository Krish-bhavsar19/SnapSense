const { google } = require('googleapis');

/**
 * Creates an authenticated Google Calendar client for a user
 */
function getCalendarClient(user) {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );
    auth.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
    });
    return google.calendar({ version: 'v3', auth });
}

/**
 * Determines if a category should trigger a calendar event
 */
function shouldCreateCalendarEvent(category, suggestedAction) {
    const autoCalendarCategories = ['Ticket', 'Payment'];
    return (
        suggestedAction === 'calendar' ||
        autoCalendarCategories.includes(category)
    );
}

/**
 * Creates a Google Calendar event for a screenshot
 * @param {Object} user - User model instance
 * @param {Object} eventData - { summary, description, date, category }
 * @returns {{ eventId, eventLink }}
 */
async function createCalendarEvent(user, eventData) {
    const calendar = getCalendarClient(user);

    // Parse the date, default to 1 week from now if invalid
    let startDateTime;
    let endDateTime;
    let allDay = false;

    if (eventData.date) {
        try {
            const parsed = new Date(eventData.date);
            if (!isNaN(parsed.getTime())) {
                startDateTime = parsed.toISOString();
                const endDate = new Date(parsed.getTime() + 60 * 60 * 1000); // +1 hour
                endDateTime = endDate.toISOString();
            } else {
                throw new Error('Invalid date');
            }
        } catch {
            // Use today + 7 days as reminder
            const reminderDate = new Date();
            reminderDate.setDate(reminderDate.getDate() + 7);
            reminderDate.setHours(9, 0, 0, 0);
            startDateTime = reminderDate.toISOString();
            endDateTime = new Date(
                reminderDate.getTime() + 60 * 60 * 1000
            ).toISOString();
        }
    } else {
        // Default: reminder in 7 days at 9 AM
        const reminderDate = new Date();
        reminderDate.setDate(reminderDate.getDate() + 7);
        reminderDate.setHours(9, 0, 0, 0);
        startDateTime = reminderDate.toISOString();
        endDateTime = new Date(
            reminderDate.getTime() + 60 * 60 * 1000
        ).toISOString();
    }

    const categoryEmojis = {
        Ticket: '🎫',
        Payment: '💳',
        Contact: '👤',
        Mail: '📧',
        Other: '📌',
    };
    const emoji = categoryEmojis[eventData.category] || '📌';

    const event = {
        summary: `${emoji} [SnapSense] ${eventData.summary || eventData.category}`,
        description: `Auto-created by SnapSense AI\n\nCategory: ${eventData.category}\n\n${eventData.description || ''}`,
        start: { dateTime: startDateTime, timeZone: 'Asia/Kolkata' },
        end: { dateTime: endDateTime, timeZone: 'Asia/Kolkata' },
        reminders: {
            useDefault: false,
            overrides: [
                { method: 'popup', minutes: 60 },
                { method: 'email', minutes: 24 * 60 },
            ],
        },
        colorId: '3', // Sage green
    };

    const res = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
    });

    return {
        eventId: res.data.id,
        eventLink: res.data.htmlLink,
    };
}

module.exports = { createCalendarEvent, shouldCreateCalendarEvent };
