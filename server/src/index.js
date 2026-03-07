require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const screenshotRoutes = require('./routes/screenshots');
const billingRoutes = require('./routes/billing');
const webhookRoutes = require('./routes/webhook');
const { initializeLemonSqueezy } = require('./config/lemonsqueezy');
const { checkSubscriptionExpiry } = require('./middleware/tierCheck');

const app = express();
const PORT = process.env.PORT || 5000;

// Required for Render/Heroku/AWS when using secure cookies
app.set('trust proxy', 1);

// ─── Core Middleware (applied before DB connects) ─────────────────────────────

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // CSP managed by frontend
  crossOriginEmbedderPolicy: false, // Allow embedded checkout
}));

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);

// CRITICAL: Raw body parser for Lemon Squeezy webhooks (BEFORE express.json())
app.use('/api/webhook/lemonsqueezy', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Basic health check (responds even before DB connects)
app.get('/health', (req, res) => {
  const dbState = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  res.json({
    status: 'ok',
    mongo: dbState[mongoose.connection.readyState] || 'unknown',
    time: new Date().toISOString(),
  });
});

// ─── Bind to port FIRST (prevents ECONNREFUSED on Vite proxy) ────────────────
app.listen(PORT, () => {
  console.log(`🚀 SnapSense Server on http://localhost:${PORT}`);
  connectDB();
});

// ─── MongoDB + Session + Routes (after port is bound) ────────────────────────
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Require SESSION_SECRET in production
    if (!process.env.SESSION_SECRET) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('SESSION_SECRET environment variable is required in production');
      }
      console.warn('⚠️  SESSION_SECRET not set — using insecure default (dev only)');
    }

    // Session store (requires MongoDB)
    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'dev-only-insecure-secret-' + require('crypto').randomBytes(16).toString('hex'),
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
          mongoUrl: process.env.MONGODB_URI,
          collectionName: 'sessions',
        }),
        cookie: {
          secure: process.env.NODE_ENV === 'production',
          httpOnly: true,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          sameSite: 'lax',
        },

      })
    );

    // Passport (requires User model via DB)
    require('./config/passport');
    app.use(passport.initialize());
    app.use(passport.session());

    // Check subscription expiry on all authenticated requests
    app.use(checkSubscriptionExpiry);

    // Initialize Lemon Squeezy SDK
    initializeLemonSqueezy();

    // Routes
    app.use('/auth', authRoutes);
    app.use('/api/screenshots', screenshotRoutes);
    app.use('/api/billing', billingRoutes);
    app.use('/api/webhook', webhookRoutes);

    // ─── Production Frontend Serving ──────────────────────────────────────────
    if (process.env.NODE_ENV === 'production') {
      const path = require('path');
      const clientDistPath = path.join(__dirname, '../../client/dist');
      
      // Serve static files from the client dist folder
      app.use(express.static(clientDistPath));

      // Catch-all route to serve index.html for client-side routing
      app.get('*', (req, res) => {
        res.sendFile(path.join(clientDistPath, 'index.html'));
      });
      console.log('🌐 Serving production frontend from client/dist');
    }

    console.log('✅ All routes registered — App fully ready!');

  } catch (err) {
    console.error('\n❌ MongoDB connection failed:', err.message);
    console.error('💡 Fix Options:');
    console.error('   1. Local MongoDB  →  run "mongod" in a new terminal');
    console.error('   2. Atlas (free)   →  update MONGODB_URI in server/.env');
    console.error('\n⏳ Retrying in 5 seconds...\n');
    setTimeout(connectDB, 5000);
  }
};

module.exports = app;
