const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler, validate } = require('../middleware/errorHandler');

// ============================================================
// PATCH /api/profile
// Uredi profil biznisa: ime, opis, telefon, boja.
// Sva polja su opcionalna - mijenja se samo ono što je poslano.
// ============================================================
router.patch('/',
  authenticateAdmin,
  [
    body('name').optional().trim().isLength({ min: 2, max: 100 })
      .withMessage('Ime mora imati 2-100 znakova.'),
    body('description').optional({ nullable: true }).trim().isLength({ max: 500 })
      .withMessage('Opis može imati najviše 500 znakova.'),
    body('phone').optional({ nullable: true }).trim().isLength({ max: 50 }),
    body('primaryColor').optional({ nullable: true })
      .matches(/^#([0-9a-fA-F]{6})$/).withMessage('Boja mora biti hex (npr. #13544A).'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, description, phone, primaryColor } = req.body;

    const result = await query(
      `UPDATE businesses
       SET name          = COALESCE($2, name),
           description    = COALESCE($3, description),
           phone          = COALESCE($4, phone),
           primary_color  = COALESCE($5, primary_color),
           updated_at     = NOW()
       WHERE id = $1
       RETURNING id, email, name, slug, phone, description,
                 primary_color, is_demo, subscription_status, trial_ends_at`,
      [
        req.business.id,
        name ?? null,
        typeof description === 'string' ? description : null,
        typeof phone === 'string' ? phone : null,
        primaryColor ?? null,
      ]
    );

    res.json({ business: result.rows[0] });
  })
);

module.exports = router;
