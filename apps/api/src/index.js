require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================================
// Security & CORS
// ============================================================
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : []),
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Rate limiting — zaštita od brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuta
  max: 100,
  message: { error: 'Previše zahtjeva. Pokušajte ponovo za 15 minuta.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Previše pokušaja prijave. Pokušajte ponovo za 15 minuta.' }
});

app.use(limiter);

// ============================================================
// Body parsing
// ============================================================
// Stripe webhook mora dobiti raw body (prije express.json!)
app.use('/api/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Health check
// ============================================================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV 
  });
});

// ============================================================
// Routes
// ============================================================
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth', require('./routes/auth'));

// Ove rute gradimo u sljedećim koracima:
app.use('/api/schedule',   require('./routes/schedule'));
app.use('/api/bookings',   require('./routes/bookings'));
app.use('/api/clients',    require('./routes/clients'));
app.use('/api/profile',   require('./routes/profile'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/dashboard',  require('./routes/dashboard'));
app.use('/api/stripe',     require('./routes/stripe'));
app.use('/api/public',     require('./routes/public'));   // Booking stranica

// ============================================================
// 404 handler
// ============================================================
app.use((req, res) => {
  res.status(404).json({ error: `Ruta ${req.method} ${req.path} ne postoji.` });
});

// ============================================================
// Global error handler
// ============================================================
app.use(errorHandler);

// ============================================================
// Start server
// ============================================================
app.listen(PORT, () => {
  console.log(`\n🚀 API server pokrenut na http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Okruženje: ${process.env.NODE_ENV || 'development'}\n`);
  require('./services/reminders').startReminderCron(); // Pokreni cron jobove nakon pokretanja servera
});

module.exports = app;
