require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const screenshotRoutes = require('./routes/screenshots');

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Core Middleware (applied before DB connects) ─────────────────────────────
app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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

    // Session store (requires MongoDB)
    app.use(
      session({
        secret: process.env.SESSION_SECRET || 'snapsense-secret',
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
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        },
      })
    );

    // Passport (requires User model via DB)
    require('./config/passport');
    app.use(passport.initialize());
    app.use(passport.session());

    // Routes
    app.use('/auth', authRoutes);
    app.use('/api/screenshots', screenshotRoutes);

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
