const express = require('express');
const router = express.Router();

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// GET /api/dashboard/stats
// Brze brojke za pregled: danas, ovaj tjedan, ukupno klijenata.
// ============================================================
router.get('/stats',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const id = req.business.id;

    const result = await query(
      `SELECT
        (SELECT COUNT(*) FROM bookings
           WHERE business_id = $1 AND status = 'confirmed'
             AND start_time::date = CURRENT_DATE) AS today,
        (SELECT COUNT(*) FROM bookings
           WHERE business_id = $1 AND status = 'confirmed'
             AND start_time >= date_trunc('week', CURRENT_DATE)
             AND start_time <  date_trunc('week', CURRENT_DATE) + INTERVAL '7 days') AS week,
        (SELECT COUNT(*) FROM clients WHERE business_id = $1) AS clients`,
      [id]
    );

    const row = result.rows[0];
    res.json({
      today: Number(row.today),
      week: Number(row.week),
      clients: Number(row.clients),
    });
  })
);

module.exports = router;
