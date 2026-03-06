# SnapSense AI 📸

> Smart screenshot classifier powered by Groq Vision AI — automatically organizes into Google Drive, logs to Google Sheets, and creates Google Calendar reminders.

## Tech Stack
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Frontend**: React + Vite + Framer Motion
- **AI**: Groq Vision (`llama-4-scout-17b-16e-instruct`)
- **Auth**: Passport.js + Google OAuth 2.0
- **Google APIs**: Drive, Sheets, Calendar

## Categories
Ticket · Wallpaper · LinkedIn Profile · LinkedIn Post · Social Media Post · Payment · Sensitive Document · Contact · Mail · Quote · WhatsApp Chat · Study Notes · Other

## Setup

### 1. Prerequisites
- Node.js ≥ 18
- MongoDB running locally (`mongodb://localhost:27017`) or Atlas URI
- Google Cloud project with OAuth 2.0 credentials
- Groq API key

### 2. Google Cloud Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project → Enable APIs: **Google Drive API**, **Google Sheets API**, **Google Calendar API**
3. OAuth consent screen → **External** → Add scopes: `drive.file`, `spreadsheets`, `calendar.events`
4. Create **OAuth 2.0 Client ID** → Web application
   - Authorized origins: `http://localhost:5000`
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
5. Copy `Client ID` and `Client Secret`

### 3. Server Environment
Edit `server/.env`:
```env
MONGODB_URI=mongodb://localhost:27017/snapsense
GOOGLE_CLIENT_ID=<your_client_id>
GOOGLE_CLIENT_SECRET=<your_client_secret>
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
SESSION_SECRET=<any_long_random_string>
GROQ_API_KEY=<your_groq_api_key>
CLIENT_URL=http://localhost:5173
```

### 4. Run the App

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

## Flow
1. User signs in with Google → consents to Drive, Sheets & Calendar access
2. User drops a screenshot on the dashboard
3. App:
   - 🤖 Classifies it with Groq AI (13 categories)
   - ☁️ Uploads to Google Drive under `📸 SnapSense AI/<Category>/`
   - 📊 Logs to Google Sheets (timestamp, category, summary, Drive link)
   - 📅 Creates Calendar event (for Tickets and Payments)
4. Dashboard shows all screenshots, category stats, Drive links

## API Endpoints
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/auth/google` | Initiate Google OAuth |
| GET | `/auth/me` | Get current user |
| POST | `/auth/logout` | Logout |
| POST | `/api/screenshots/upload` | Upload + classify screenshot |
| GET | `/api/screenshots` | List all screenshots |
| GET | `/api/screenshots/stats` | Category counts |
| GET | `/api/screenshots/category/:cat` | Filter by category |
| DELETE | `/api/screenshots/:id` | Delete screenshot |
