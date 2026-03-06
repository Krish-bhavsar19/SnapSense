const { google } = require('googleapis');
const User = require('../models/User');

const CATEGORY_FOLDER_NAMES = [
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
];

/**
 * Creates an authenticated Google Drive client for a user
 */
function getDriveClient(user) {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );
    auth.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
    });
    return google.drive({ version: 'v3', auth });
}

/**
 * Creates a folder in Google Drive
 */
async function createFolder(drive, name, parentId = null) {
    const metadata = {
        name,
        mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentId) {
        metadata.parents = [parentId];
    }
    const res = await drive.files.create({
        requestBody: metadata,
        fields: 'id, name',
    });
    return res.data.id;
}

/**
 * Ensures the user's full Drive folder structure exists.
 * Root: SnapSense AI/
 *   ├── Ticket/
 *   ├── Wallpaper/
 *   ├── ... (all categories)
 */
async function ensureUserFolders(user) {
    const drive = getDriveClient(user);

    // Create root folder if not exists
    if (!user.driveRootFolderId) {
        const rootId = await createFolder(drive, '📸 SnapSense AI');
        user.driveRootFolderId = rootId;
        await user.save();
        console.log(`✅ Created Drive root folder for ${user.email}`);
    }

    // Create category sub-folders if missing
    const updatedFolders = user.driveCategoryFolders
        ? new Map(user.driveCategoryFolders)
        : new Map();

    for (const category of CATEGORY_FOLDER_NAMES) {
        if (!updatedFolders.has(category)) {
            const folderId = await createFolder(
                drive,
                category,
                user.driveRootFolderId
            );
            updatedFolders.set(category, folderId);
            console.log(`📁 Created Drive folder: ${category}`);
        }
    }

    user.driveCategoryFolders = updatedFolders;
    await user.save();

    return user;
}

/**
 * Uploads a file buffer to Google Drive in the appropriate category folder.
 * Returns { fileId, webViewLink, thumbnailLink }
 */
async function uploadFileToDrive(user, buffer, filename, mimeType, category) {
    // Ensure folders exist
    const updatedUser = await ensureUserFolders(user);
    const drive = getDriveClient(updatedUser);

    const categoryFolderId = updatedUser.driveCategoryFolders.get(category);

    const { Readable } = require('stream');
    const stream = Readable.from(buffer);

    const res = await drive.files.create({
        requestBody: {
            name: filename,
            parents: [categoryFolderId],
        },
        media: {
            mimeType,
            body: stream,
        },
        fields: 'id, webViewLink, thumbnailLink',
    });

    // Make the file viewable by anyone with the link
    await drive.permissions.create({
        fileId: res.data.id,
        requestBody: {
            role: 'reader',
            type: 'anyone',
        },
    });

    return {
        fileId: res.data.id,
        webViewLink: res.data.webViewLink,
        thumbnailLink: res.data.thumbnailLink,
    };
}

module.exports = { ensureUserFolders, uploadFileToDrive };
