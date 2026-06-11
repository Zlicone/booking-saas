const { validationResult } = require('express-validator');

// Wrapper za async route handlere — eliminira try/catch u svakom routeu
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Provjera validation rezultata (express-validator)
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validacijska greška',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

// Globalni error handler (zadnji middleware u Express lancu)
const errorHandler = (err, req, res, next) => {
  console.error(`[${new Date().toISOString()}] Error:`, err);
  
  // PostgreSQL unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Taj zapis već postoji.' });
  }
  
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencijski zapis ne postoji.' });
  }
  
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Greška na serveru. Pokušajte ponovo.'
      : err.message
  });
};

module.exports = { asyncHandler, validate, errorHandler };
