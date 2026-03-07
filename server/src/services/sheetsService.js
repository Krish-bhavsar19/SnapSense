const { google } = require('googleapis');

const HEADERS_DEFAULT = [
    'Timestamp',
    'Category',
    'Summary',
    'Date Detected',
    'Action Taken',
    'Drive Link',
    'Calendar Event',
    'Confidence',
];

const HEADERS_QUOTES = [
    'Timestamp',
    'Quote Summary',
    'Author',
    'Genre',
    'Drive Link',
    'Confidence',
];

const HEADERS_TRANSACTIONS = [
    'Timestamp',
    'Transaction Type (Credit/Debit)',
    'Date',
    'Time',
    'Amount',
    'Drive Link',
    'Confidence',
];

const HEADERS_LOCATIONS = [
    'Timestamp',
    'Location Name',
    'Location Category',
    'Summary',
    'Google Maps Link',
    'Drive Link',
    'Confidence',
];

/**
 * Creates an authenticated Google Sheets client for a user
 */
function getSheetsClient(user) {
    const auth = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_CALLBACK_URL
    );
    auth.setCredentials({
        access_token: user.accessToken,
        refresh_token: user.refreshToken,
    });
    return google.sheets({ version: 'v4', auth });
}

function createSheetObj(title, headers) {
    return {
        properties: { title },
        data: [
            {
                startRow: 0,
                startColumn: 0,
                rowData: [
                    {
                        values: headers.map((h) => ({
                            userEnteredValue: { stringValue: h },
                            userEnteredFormat: {
                                backgroundColor: { red: 0.17, green: 0.49, blue: 0.82 },
                                textFormat: {
                                    bold: true,
                                    foregroundColor: { red: 1, green: 1, blue: 1 },
                                },
                            },
                        })),
                    },
                ],
            },
        ],
    };
}

/**
 * Ensures the user has a SnapSense spreadsheet with headers.
 * Creates one if it doesn't exist yet.
 * Returns the spreadsheet ID.
 */
async function ensureUserSheet(user) {
    const sheets = getSheetsClient(user);

    if (!user.sheetsId) {
        const res = await sheets.spreadsheets.create({
            requestBody: {
                properties: {
                    title: '📊 SnapSense AI — Screenshot Log',
                },
                sheets: [
                    createSheetObj('Screenshots', HEADERS_DEFAULT),
                    createSheetObj('Quotes', HEADERS_QUOTES),
                    createSheetObj('Transactions', HEADERS_TRANSACTIONS),
                    createSheetObj('Locations', HEADERS_LOCATIONS),
                ],
            },
        });

        const spreadsheetId = res.data.spreadsheetId;
        user.sheetsId = spreadsheetId;
        await user.save();

        console.log(`✅ Created Google Sheet for ${user.email}: ${spreadsheetId}`);
        return spreadsheetId;
    }

    // Verify existing sheets and add missing tabs retroactively
    try {
        const spreadSheet = await sheets.spreadsheets.get({ spreadsheetId: user.sheetsId });
        const existingTitles = spreadSheet.data.sheets.map(s => s.properties.title);
        
        const requiredSheets = [
            { title: 'Screenshots', headers: HEADERS_DEFAULT },
            { title: 'Quotes', headers: HEADERS_QUOTES },
            { title: 'Transactions', headers: HEADERS_TRANSACTIONS },
            { title: 'Locations', headers: HEADERS_LOCATIONS }
        ];

        const missingSheets = requiredSheets.filter(req => !existingTitles.includes(req.title));

        if (missingSheets.length > 0) {
            console.log(`📊 Adding missing sheets (${missingSheets.map(s => s.title).join(', ')}) for ${user.email}`);
            const addSheetRequests = missingSheets.map(req => ({
                addSheet: { properties: { title: req.title } }
            }));

            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: user.sheetsId,
                requestBody: { requests: addSheetRequests }
            });

            // Populate simple headers for missing sheets
            for (const req of missingSheets) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: user.sheetsId,
                    range: `${req.title}!A1`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values: [req.headers] }
                });
            }
        }
        
        return user.sheetsId;
    } catch (err) {
        console.error('⚠️ Error checking existing sheet tabs:', err.message);
        if (err.code === 404) {
            user.sheetsId = null;
            return ensureUserSheet(user);
        }
        return user.sheetsId;
    }
}

/**
 * Appends a generic row to the 'Screenshots' sheet.
 */
async function appendRow(user, rowData) {
    const spreadsheetId = await ensureUserSheet(user);
    const sheets = getSheetsClient(user);

    const values = [
        rowData.timestamp || new Date().toISOString(),
        rowData.category || '',
        rowData.summary || '',
        rowData.dateDetected || '',
        rowData.actionTaken || 'none',
        rowData.driveLink || '',
        rowData.calendarEventLink || '',
        rowData.confidence ? `${Math.round(rowData.confidence * 100)}%` : '',
    ];

    const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Screenshots!A:H',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
    });

    const updatedRange = appendRes.data.updates?.updatedRange || '';
    const rowMatch = updatedRange.match(/:([A-Z]+)(\d+)$/);
    return rowMatch ? parseInt(rowMatch[2]) : null;
}

/**
 * Appends a row to the 'Quotes' sheet.
 */
async function appendQuoteRow(user, rowData) {
    const spreadsheetId = await ensureUserSheet(user);
    const sheets = getSheetsClient(user);
    const values = [
        rowData.timestamp || new Date().toISOString(),
        rowData.summary || '',
        rowData.quoteAuthor || '',
        rowData.quoteGenre || '',
        rowData.driveLink || '',
        rowData.confidence ? `${Math.round(rowData.confidence * 100)}%` : '',
    ];

    const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Quotes!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
    });
    const match = (appendRes.data.updates?.updatedRange || '').match(/:([A-Z]+)(\d+)$/);
    return match ? parseInt(match[2]) : null;
}

/**
 * Appends a row to the 'Transactions' sheet.
 */
async function appendTransactionRow(user, rowData) {
    const spreadsheetId = await ensureUserSheet(user);
    const sheets = getSheetsClient(user);
    const values = [
        rowData.timestamp || new Date().toISOString(),
        rowData.transactionType || '',
        rowData.dateDetected || '',
        rowData.transactionTime || '',
        rowData.transactionAmount || '',
        rowData.driveLink || '',
        rowData.confidence ? `${Math.round(rowData.confidence * 100)}%` : '',
    ];

    const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Transactions!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
    });
    const match = (appendRes.data.updates?.updatedRange || '').match(/:([A-Z]+)(\d+)$/);
    return match ? parseInt(match[2]) : null;
}

/**
 * Appends a row to the 'Locations' sheet.
 */
async function appendLocationRow(user, rowData) {
    const spreadsheetId = await ensureUserSheet(user);
    const sheets = getSheetsClient(user);
    const values = [
        rowData.timestamp || new Date().toISOString(),
        rowData.locationName || '',
        rowData.locationCategory || '',
        rowData.summary || '',
        rowData.mapLink || '',
        rowData.driveLink || '',
        rowData.confidence ? `${Math.round(rowData.confidence * 100)}%` : '',
    ];

    const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Locations!A:G',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [values] },
    });
    const match = (appendRes.data.updates?.updatedRange || '').match(/:([A-Z]+)(\d+)$/);
    return match ? parseInt(match[2]) : null;
}

/**
 * Clears a specific row from the user's SnapSense spreadsheet.
 * NOTE: Google Sheets API doesn't support deleting rows by number directly
 * without knowing the sheet. We clear the row content to keep the sheet intact.
 * @param {Object} user - User model instance
 * @param {number} rowNumber - The 1-indexed row number in the sheet
 * @param {string} sheetName - The sheet tab name (default: 'Screenshots')
 */
async function deleteSheetRow(user, rowNumber, sheetName = 'Screenshots') {
    if (!rowNumber || !user.sheetsId) return;
    const sheets = getSheetsClient(user);
    try {
        // Get the sheet's ID (gid) for the given tab name
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: user.sheetsId });
        const sheetMeta = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheetMeta) {
            console.warn(`⚠️  Sheet tab "${sheetName}" not found, skipping row delete.`);
            return;
        }
        const sheetId = sheetMeta.properties.sheetId;

        // Delete the actual row by shifting rows above it up
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: user.sheetsId,
            requestBody: {
                requests: [{
                    deleteDimension: {
                        range: {
                            sheetId,
                            dimension: 'ROWS',
                            startIndex: rowNumber - 1, // 0-indexed
                            endIndex: rowNumber,       // exclusive
                        },
                    },
                }],
            },
        });
        console.log(`🗑️  Deleted row ${rowNumber} from sheet "${sheetName}"`);
    } catch (err) {
        if (err.code === 404) {
            console.warn(`⚠️  Sheet not found (already deleted?): ${user.sheetsId}`);
        } else {
            throw err;
        }
    }
}

module.exports = { ensureUserSheet, appendRow, appendQuoteRow, appendTransactionRow, appendLocationRow, deleteSheetRow };
