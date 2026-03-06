const { google } = require('googleapis');

/**
 * Creates an authenticated Google Tasks client for a user
 */
function getTasksClient(user) {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );
    auth.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
    });
    return google.tasks({ version: 'v1', auth });
}

/**
 * Determines if a category should trigger a Google Task event
 */
function shouldCreateGoogleTask(category, suggestedAction) {
    const autoTaskCategories = ['Study Notes'];
    return (
        suggestedAction === 'task' ||
        autoTaskCategories.includes(category)
    );
}

/**
 * Creates a Google Task event for a screenshot
 * @param {Object} user - User model instance
 * @param {Object} taskData - { title, notes, due }
 * @returns {{ taskId, taskLink }}
 */
async function createGoogleTask(user, taskData) {
    const tasks = getTasksClient(user);

    // Get the default task list '@default'
    const taskListId = '@default';

    const taskBody = {
        title: `[SnapSense] ${taskData.title}`,
        notes: `Auto-created by SnapSense AI\n\n${taskData.notes || ''}`,
    };

    if (taskData.due) {
        try {
            const parsed = new Date(taskData.due);
            if (!isNaN(parsed.getTime())) {
                taskBody.due = parsed.toISOString();
            }
        } catch (err) {
            console.error('Task due date parse error:', err.message);
        }
    }

    const res = await tasks.tasks.insert({
        tasklist: taskListId,
        requestBody: taskBody,
    });

    return {
        taskId: res.data.id,
        // Google Tasks doesn't return a direct web link per task typically,
        // but it is accessible in Google Tasks sidebar or app.
        taskLink: `https://mail.google.com/tasks/canvas`,
    };
}

module.exports = { createGoogleTask, shouldCreateGoogleTask };
