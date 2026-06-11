const express = require('express');
const router = express.Router();

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// GET /api/clients
// Svi klijenti biznisa + broj nadolazećih termina.
// ============================================================
router.get('/',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const result = await query(
      `SELECT
         c.id,
         c.name,
         c.email,
         c.phone,
         c.total_bookings              AS "totalBookings",
         c.is_blocked                  AS "isBlocked",
         c.notes,
         to_char(c.created_at, 'YYYY-MM-DD') AS "createdAt",
         (SELECT COUNT(*) FROM bookings b
            WHERE b.client_id = c.id
              AND b.status = 'confirmed'
              AND b.start_time >= NOW())      AS upcoming
       FROM clients c
       WHERE c.business_id = $1
       ORDER BY c.name`,
      [req.business.id]
    );

    const clients = result.rows.map((c) => ({
      ...c,
      upcoming: Number(c.upcoming),
    }));

    res.json({ clients });
  })
);

// ============================================================
// PATCH /api/clients/:id
// Ažuriraj klijenta: blokiraj/odblokiraj i/ili bilješka.
// Tijelo: { isBlocked?: boolean, notes?: string }
// ============================================================
router.patch('/:id',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { isBlocked, notes } = req.body;

    const result = await query(
      `UPDATE clients
       SET is_blocked = COALESCE($3, is_blocked),
           notes      = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $1 AND business_id = $2
       RETURNING id, is_blocked AS "isBlocked", notes`,
      [
        req.params.id,
        req.business.id,
        typeof isBlocked === 'boolean' ? isBlocked : null,
        typeof notes === 'string' ? notes : null,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Klijent nije pronađen.' });
    }
    res.json({ client: result.rows[0] });
  })
);

module.exports = router;
