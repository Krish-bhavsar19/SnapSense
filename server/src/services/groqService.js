const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const CATEGORIES = [
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
];

const SYSTEM_PROMPT = `You are SnapSense AI, an expert screenshot classifier. Analyze the given screenshot image and classify it into exactly ONE of these categories:
${CATEGORIES.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Return a JSON object ONLY (no markdown, no extra text) with this exact structure:
{
  "category": "<one of the categories above>",
  "summary": "<one sentence describing the screenshot content>",
  "date": "<ISO 8601 datetime string if a specific date/time is visible, else null>",
  "suggestedAction": "<'calendar' if it should be added to calendar, 'task' if it is a to-do list/task item to add to Google Tasks, 'sheet' if it should be logged in Google Sheets (e.g., Payment, Quote, Location), 'contact' if it should be saved as contact, 'none' otherwise>",
  "confidence": <number between 0 and 1>,
  "quoteAuthor": "<If Quote, the author's name, else null>",
  "quoteGenre": "<If Quote, the genre/theme (e.g., 'Motivation', 'Philosophy'), else null>",
  "transactionType": "<If Payment, strictly 'Credit' or 'Debit', else null>",
  "transactionTime": "<If Payment, the isolated time string (e.g., '14:30' or '2:30 PM'), else null>",
  "transactionAmount": "<If Payment, the isolated amount with currency symbol, else null>",
  "locationName": "<If Location, the specific name of the place, else null>",
  "locationCategory": "<If it's a Location, classify the type: e.g. 'Travel', 'Food', 'Shopping', else null>",
  "mapLink": "<If it's a Location, generate a generic Google Maps search URL for it, e.g. 'https://www.google.com/maps/search/?api=1&query=Location+Name', else null>"
}

Rules:
- Location: ONLY classify as Location when the screenshot explicitly mentions or shows a specific place name, address, restaurant name, hotel, shop, landmark, or travel destination. There MUST be a clearly visible place name, map, directions, or address in the screenshot. Do NOT classify generic outdoor photos, scenic images, or photos that merely show a place without naming it as Location — those should be Wallpaper or Other instead.
- Ticket: flight/train/bus/event/concert/sports tickets with booking info
- Wallpaper: decorative/aesthetic images used as backgrounds, scenic photos, nature shots, or any image without explicit text identifying a specific place
- LinkedIn Profile: screenshots of a LinkedIn user profile page
- LinkedIn Post: screenshots of a LinkedIn post/article/feed
- Social Media Post: Twitter/Instagram/Facebook/TikTok/Reddit posts
- Payment: receipts, invoices, payment confirmations, bank transactions (should be logged to 'sheet')
- Sensitive Document: Aadhar, PAN, passport, ID cards, medical records, legal docs
- Contact: business cards, contact details, phone numbers
- Mail: email screenshots (Gmail, Outlook, etc.)
- Quote: motivational/inspirational quote images (should be logged to 'sheet')
- WhatsApp Chat: WhatsApp or messaging app conversation screenshots
- Study Notes: handwritten notes, textbook pages, slides, educational content
- Other: anything that doesn't fit above`;

/**
 * Classifies a screenshot image using Groq Vision API
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimeType - The MIME type of the image (e.g., 'image/png')
 * @returns {Promise<{category, summary, date, suggestedAction, confidence}>}
 */
async function classifyScreenshot(imageBuffer, mimeType = 'image/png') {
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    const response = await groq.chat.completions.create({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: SYSTEM_PROMPT,
                    },
                    {
                        type: 'image_url',
                        image_url: { url: dataUrl },
                    },
                ],
            },
        ],
        max_tokens: 500,
        temperature: 0.1,
        response_format: { type: 'json_object' },
    });

    const rawText = response.choices[0]?.message?.content || '{}';

    try {
        // Strip any markdown code blocks if present
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

        // Validate category
        if (!CATEGORIES.includes(parsed.category)) {
            parsed.category = 'Other';
        }

        return {
            category: parsed.category || 'Other',
            summary: parsed.summary || 'No summary available',
            date: parsed.date || null,
            suggestedAction: parsed.suggestedAction || 'none',
            confidence: parseFloat(parsed.confidence) || 0.5,
            quoteAuthor: parsed.quoteAuthor || null,
            quoteGenre: parsed.quoteGenre || null,
            transactionType: parsed.transactionType || null,
            transactionTime: parsed.transactionTime || null,
            transactionAmount: parsed.transactionAmount || null,
            locationName: parsed.locationName || null,
            locationCategory: parsed.locationCategory || null,
            mapLink: parsed.mapLink || null,
            rawAI: rawText,
        };
    } catch (parseError) {
        console.error('Failed to parse Groq response:', rawText);
        return {
            category: 'Other',
            summary: 'Could not analyze image',
            date: null,
            suggestedAction: 'none',
            confidence: 0,
            quoteAuthor: null,
            quoteGenre: null,
            transactionType: null,
            transactionTime: null,
            transactionAmount: null,
            locationName: null,
            locationCategory: null,
            mapLink: null,
            rawAI: rawText,
        };
    }
}

module.exports = { classifyScreenshot, CATEGORIES };
