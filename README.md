# SnapSense AI 📸

> **Your Screenshots, Finally Organized.**
> Smart screenshot classifier powered by Groq Vision AI — automatically organizes into your Google Drive, logs data to Google Sheets, creates Google Calendar reminders, and generates Google Tasks.

![SnapSense Banner](https://via.placeholder.com/800x400?text=SnapSense+AI+Banner) *(Optional: Replace with actual screenshot later)*

## ✨ Key Features
- **🤖 Instant AI Classification:** Classifies any uploaded screenshot instantly into 13 smart categories (e.g., Tickets, Payments, Quotes, Study Notes, etc.) using Groq Vision (`llama-3.2-90b-vision-preview`).
- **☁️ Seamless Google Integration:**
  - **Google Drive:** Auto-organizes files into dedicated category folders under `📸 SnapSense AI/`.
  - **Google Sheets:** Logs transaction amounts, quotes, and addresses neatly into categorized tabs.
  - **Google Calendar:** Automatically creates reminders/events for tickets or payment deadlines.
  - **Google Tasks:** Turns your study notes into actionable Google Tasks.
  - **Google Maps:** Generates direct Maps links for address/location screenshots.
- **🌗 Theme Toggle:** Beautiful Light and Dark modes with fluid Framer Motion animations.
- **👻 Anonymous Previews:** Try dropping a screenshot without signing in (up to 3 previews). Sign in later to automatically sync them to your account!
- **💳 Pro Subscriptions:** Built-in Lemon Squeezy billing integration to handle Free Tier quotas (e.g., limit of 10 uploads/mo) and unlimited Pro plans.
- **🎨 Modern Dashboard:** Built with React and Vanilla CSS, featuring glassmorphism, responsive grid layouts, and top category breakdown.

## 🛠️ Tech Stack
- **Frontend**: React.js + Vite + Framer Motion + React Dropzone
- **Backend**: Node.js + Express.js
- **Database**: MongoDB (via Mongoose)
- **AI Engine**: Groq Vision API
- **Authentication**: Passport.js with Google OAuth 2.0
- **Third-Party Integrations**: Google APIs (Drive, Sheets, Calendar, Tasks), Lemon Squeezy (Payments & Webhooks)

## 📂 Categories Handled
`Ticket` · `Wallpaper` · `LinkedIn Profile` · `LinkedIn Post` · `Social Media Post` · `Payment` · `Sensitive Document` · `Contact` · `Mail` · `Quote` · `WhatsApp Chat` · `Study Notes` · `Other`

---

## 🚀 Local Setup Guide

### 1. Prerequisites
- **Node.js**: v18 or later
- **MongoDB**: Local instance running on port `27017` or a MongoDB Atlas URI
- **Google Cloud Platform (GCP)** Account
- **Groq API Key**
- **Lemon Squeezy** Account (for Stripe-like billing if testing payments locally)

### 2. Google Cloud OAuth & API Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and enable the following APIs:
   - **Google Drive API**
   - **Google Sheets API**
   - **Google Calendar API**
   - **Google Tasks API**
3. Configure the **OAuth Consent Screen** (External). Add scopes: `drive.file`, `spreadsheets`, `calendar.events`, `tasks`.
4. Create **OAuth 2.0 Client IDs** (Web application).
   - Authorized Javascript origins: `http://localhost:5000` (and frontend `http://localhost:5173`)
   - Authorized redirect URIs: `http://localhost:5000/auth/google/callback`
5. Copy your `Client ID` and `Client Secret`.

### 3. Environment Variables
Create a `.env` file in the **`server`** directory:
```env
# Server Config
PORT=5000
CLIENT_URL=http://localhost:5173

# Database
MONGODB_URI=mongodb://localhost:27017/snapsense

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Session
SESSION_SECRET=a_super_secure_random_string

# AI
GROQ_API_KEY=your_groq_api_key

# Billing (Lemon Squeezy)
LEMON_SQUEEZY_API_KEY=your_ls_api_key
LEMON_SQUEEZY_WEBHOOK_SECRET=your_webhook_secret
```

Create a `.env` file in the **`client`** directory (not absolutely required if defaulting, but good practice if setting strict backend paths):
```env
VITE_API_URL=http://localhost:5000
```

### 4. Running the Application

**Terminal 1 — Backend:**
```bash
cd server
npm install
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm install
npm run dev
```

Open your browser and navigate to [http://localhost:5173](http://localhost:5173).

---

## ⚙️ Architecture & Data Flow
1. **User Landing:** Unauthenticated users can upload images up to their free trial cap. Front-end caches unassigned images in local storage.
2. **Authentication:** User signs in via Google OAuth → Consents to Google Services → Backend provisions DB user → Local cached images are merged to account.
3. **Uploads:** User drops an image → Frontend sends binary blob -> Backend queries **Groq Vision API** for structural image analysis.
4. **Google Integrations:** 
   - Backend calls **Google Drive SDK** to upload under `SnapSense AI/Category`.
   - Modifies specific categorized tabs using **Google Sheets SDK**.
   - Generates dates/tasks to pass into **Google Calendar/Tasks SDK**.
5. **Billing Sync:** User visits `/upgrade` → Backend creates Lemon Squeezy Checkout Session → LS Webhooks update user Tier to `pro` asynchronously.

## 🤝 Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## 📝 License
© 2026 SnapSense AI - Built for the Hackathon
