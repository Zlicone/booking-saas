const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');

const { query, withTransaction } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler, validate } = require('../middleware/errorHandler');

// ============================================================
// Helper: generiraj JWT token
// ============================================================
const generateToken = (businessId, email) => {
  return jwt.sign(
    { businessId, email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ============================================================
// Helper: generiraj slug iz imena
// ============================================================
const generateSlug = async (name) => {
  // "Ivan Horvat PT" -> "ivan-horvat-pt"
  let baseSlug = name
    .toLowerCase()
    .replace(/[čć]/g, 'c')
    .replace(/[žž]/g, 'z')
    .replace(/[šš]/g, 's')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  
  let slug = baseSlug;
  let counter = 1;
  
  // Provjeri jedinstvenost, dodaj broj ako treba
  while (true) {
    const existing = await query('SELECT id FROM businesses WHERE slug = $1', [slug]);
    if (!existing.rows[0]) break;
    slug = `${baseSlug}-${counter++}`;
  }
  
  return slug;
};

// ============================================================
// POST /api/auth/register
// Registracija novog biznisa
// ============================================================
router.post('/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Nevažeća email adresa'),
    body('password').isLength({ min: 8 }).withMessage('Lozinka mora imati min. 8 znakova'),
    body('name').trim().isLength({ min: 2, max: 100 }).withMessage('Ime mora imati 2-100 znakova'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password, name, phone } = req.body;
    
    // Provjeri postoji li već email
    const existing = await query(
      'SELECT id FROM businesses WHERE email = $1',
      [email]
    );
    
    if (existing.rows[0]) {
      return res.status(409).json({ 
        error: 'Račun s tom email adresom već postoji.' 
      });
    }
    
    // Hashiraj lozinku
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Generiraj slug
    const slug = await generateSlug(name);
    
    // Email verifikacijski token
    const verifyToken = uuidv4().replace(/-/g, '');
    const verifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    
    // Kreiraj biznis
    const result = await query(`
      INSERT INTO businesses (
        email, password_hash, name, slug, phone,
        email_verify_token, email_verify_expires,
        subscription_status, trial_ends_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'trial', NOW() + INTERVAL '14 days')
      RETURNING id, email, name, slug, subscription_status, trial_ends_at, created_at
    `, [email, passwordHash, name, slug, phone || null, verifyToken, verifyExpires]);
    
    const business = result.rows[0];
    
    // Postavi defaultni raspored (Pon-Pet, 9-18h, 60min termini)
    await query(`
      INSERT INTO schedules (business_id, day_of_week, start_time, end_time, slot_duration, is_active)
      VALUES 
        ($1, 1, '09:00', '18:00', 60, true),
        ($1, 2, '09:00', '18:00', 60, true),
        ($1, 3, '09:00', '18:00', 60, true),
        ($1, 4, '09:00', '18:00', 60, true),
        ($1, 5, '09:00', '18:00', 60, true),
        ($1, 6, '09:00', '13:00', 60, false),
        ($1, 0, '09:00', '13:00', 60, false)
    `, [business.id]);
    
    // TODO: Pošalji verifikacijski email
    // await sendVerificationEmail(email, name, verifyToken);
    
    const token = generateToken(business.id, business.email);
    
    res.status(201).json({
      message: 'Račun uspješno kreiran! Trial period: 14 dana.',
      token,
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        slug: business.slug,
        subscriptionStatus: business.subscription_status,
        trialEndsAt: business.trial_ends_at,
        bookingUrl: `${process.env.FRONTEND_URL}/book/${business.slug}`,
      }
    });
  })
);

// ============================================================
// POST /api/auth/login
// ============================================================
router.post('/login',
  [
    body('email').isEmail().normalizeEmail().withMessage('Nevažeća email adresa'),
    body('password').notEmpty().withMessage('Lozinka je obavezna'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    
    const result = await query(
      `SELECT id, email, password_hash, name, slug, is_active, 
              is_demo, subscription_status, trial_ends_at, primary_color
       FROM businesses WHERE email = $1`,
      [email]
    );
    
    const business = result.rows[0];
    
    // Uvijek komparira hash (sprječava timing attack)
    const isValid = business 
      ? await bcrypt.compare(password, business.password_hash)
      : await bcrypt.compare(password, '$2a$12$invalidhashfortimingatack');
    
    if (!business || !isValid) {
      return res.status(401).json({ 
        error: 'Pogrešan email ili lozinka.' 
      });
    }
    
    if (!business.is_active) {
      return res.status(403).json({ error: 'Vaš račun je deaktiviran.' });
    }
    
    const token = generateToken(business.id, business.email);
    
    res.json({
      token,
      business: {
        id: business.id,
        email: business.email,
        name: business.name,
        slug: business.slug,
        isDemo: business.is_demo,
        subscriptionStatus: business.subscription_status,
        trialEndsAt: business.trial_ends_at,
        primaryColor: business.primary_color,
        bookingUrl: `${process.env.FRONTEND_URL}/book/${business.slug}`,
      }
    });
  })
);

// ============================================================
// GET /api/auth/me
// Dohvati trenutnog korisnika (za provjeru sesije)
// ============================================================
router.get('/me',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT 
        id, email, name, slug, phone, description,
        primary_color, logo_url, is_demo,
        subscription_status, trial_ends_at, subscription_ends_at,
        email_verified, created_at
      FROM businesses WHERE id = $1
    `, [req.business.id]);
    
    const business = result.rows[0];
    
    // Izračunaj koliko dana trial ostaje
    const trialDaysLeft = business.trial_ends_at 
      ? Math.max(0, Math.ceil((new Date(business.trial_ends_at) - new Date()) / (1000 * 60 * 60 * 24)))
      : 0;
    
    res.json({
      business: {
        ...business,
        trialDaysLeft,
        bookingUrl: `${process.env.FRONTEND_URL}/book/${business.slug}`,
      }
    });
  })
);

// ============================================================
// POST /api/auth/forgot-password
// ============================================================
router.post('/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  validate,
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    
    const result = await query(
      'SELECT id, name FROM businesses WHERE email = $1',
      [email]
    );
    
    // Uvijek vrati isti odgovor (ne otkrivaj postoji li email)
    if (result.rows[0]) {
      const resetToken = uuidv4().replace(/-/g, '');
      const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1h
      
      await query(
        'UPDATE businesses SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
        [resetToken, resetExpires, result.rows[0].id]
      );
      
      // TODO: Pošalji reset email
      // await sendPasswordResetEmail(email, result.rows[0].name, resetToken);
    }
    
    res.json({ 
      message: 'Ako taj email postoji, primiti ćete upute za resetiranje lozinke.' 
    });
  })
);

// ============================================================
// POST /api/auth/reset-password
// ============================================================
router.post('/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 8 }).withMessage('Lozinka mora imati min. 8 znakova'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { token, password } = req.body;
    
    const result = await query(
      `SELECT id FROM businesses 
       WHERE reset_token = $1 AND reset_token_expires > NOW()`,
      [token]
    );
    
    if (!result.rows[0]) {
      return res.status(400).json({ 
        error: 'Token je nevažeći ili je istekao.' 
      });
    }
    
    const passwordHash = await bcrypt.hash(password, 12);
    
    await query(
      `UPDATE businesses 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, result.rows[0].id]
    );
    
    res.json({ message: 'Lozinka je uspješno promijenjena.' });
  })
);

// ============================================================
// PATCH /api/auth/change-password
// ============================================================
router.patch('/change-password',
  authenticateAdmin,
  [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 8 }),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    const result = await query(
      'SELECT password_hash FROM businesses WHERE id = $1',
      [req.business.id]
    );
    
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Trenutna lozinka nije ispravna.' });
    }
    
    const newHash = await bcrypt.hash(newPassword, 12);
    await query(
      'UPDATE businesses SET password_hash = $1 WHERE id = $2',
      [newHash, req.business.id]
    );
    
    res.json({ message: 'Lozinka uspješno promijenjena.' });
  })
);

module.exports = router;
