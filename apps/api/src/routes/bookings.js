const express = require('express');
const router = express.Router();
const { body } = require('express-validator');

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler, validate } = require('../middleware/errorHandler');

// --- Pomoćne funkcije (iste kao u public.js) ---
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function generateSlots(schedule) {
  const startMin = toMinutes(schedule.start_time);
  const endMin = toMinutes(schedule.end_time);
  const step = schedule.slot_duration + schedule.break_between;
  const slots = [];
  for (let m = startMin; m + schedule.slot_duration <= endMin; m += step) {
    slots.push(toHHMM(m));
  }
  return slots;
}
function dayOfWeek(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ============================================================
// GET /api/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD
// Sve potvrđene rezervacije u rasponu (s podacima klijenta).
// ============================================================
router.get('/',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
      return res.status(400).json({ error: 'Nedostaje from/to datum (YYYY-MM-DD).' });
    }

    const result = await query(
      `SELECT b.id,
              to_char(b.start_time, 'YYYY-MM-DD') AS date,
              to_char(b.start_time, 'HH24:MI')    AS time,
              to_char(b.end_time,   'HH24:MI')    AS "endTime",
              b.duration_minutes                  AS "durationMinutes",
              b.status,
              c.name  AS "clientName",
              c.email AS "clientEmail",
              c.phone AS "clientPhone"
       FROM bookings b
       JOIN clients c ON c.id = b.client_id
       WHERE b.business_id = $1
         AND b.status = 'confirmed'
         AND b.start_time::date BETWEEN $2::date AND $3::date
       ORDER BY b.start_time`,
      [req.business.id, from, to]
    );

    res.json({ bookings: result.rows });
  })
);

// ============================================================
// PATCH /api/bookings/:id/cancel
// Biznis otkazuje rezervaciju.
// ============================================================
router.patch('/:id/cancel',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const { reason } = req.body;
    const result = await query(
      `UPDATE bookings
       SET status = 'canceled_by_business', canceled_at = NOW(),
           canceled_by = 'business', cancel_reason = $3
       WHERE id = $1 AND business_id = $2 AND status = 'confirmed'
       RETURNING id`,
      [req.params.id, req.business.id, reason || null]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Rezervacija nije pronađena.' });
    }
    res.json({ message: 'Rezervacija otkazana.' });
  })
);

// ============================================================
// PATCH /api/bookings/:id/reschedule
// Premjesti rezervaciju na novi datum/vrijeme.
// Tijelo: { date: "YYYY-MM-DD", time: "HH:MM" }
// ============================================================
router.patch('/:id/reschedule',
  authenticateAdmin,
  [
    body('date').matches(DATE_RE).withMessage('Neispravan datum.'),
    body('time').matches(TIME_RE).withMessage('Neispravno vrijeme.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { date, time } = req.body;

    // Dohvati rezervaciju (provjeri vlasništvo + da je potvrđena)
    const existing = await query(
      `SELECT id, duration_minutes FROM bookings
       WHERE id = $1 AND business_id = $2 AND status = 'confirmed'`,
      [req.params.id, req.business.id]
    );
    if (existing.rowCount === 0) {
      return res.status(404).json({ error: 'Rezervacija nije pronađena.' });
    }
    const duration = existing.rows[0].duration_minutes;

    // Raspored za novi dan
    const sched = await query(
      `SELECT is_active,
              to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time,   'HH24:MI') AS end_time,
              slot_duration, break_between
       FROM schedules WHERE business_id = $1 AND day_of_week = $2`,
      [req.business.id, dayOfWeek(date)]
    );
    const s = sched.rows[0];
    if (!s || !s.is_active) {
      return res.status(400).json({ error: 'Tog dana se ne radi.' });
    }
    if (!generateSlots(s).includes(time)) {
      return res.status(400).json({ error: 'Taj termin nije dostupan.' });
    }

    const startTs = `${date} ${time}:00`;
    const endTs = `${date} ${toHHMM(toMinutes(time) + duration)}:00`;

    // Premjesti SAMO ako novi termin nije zauzet nekom drugom rezervacijom
    const result = await query(
      `UPDATE bookings
       SET start_time = $3::timestamp, end_time = $4::timestamp, updated_at = NOW()
       WHERE id = $1 AND business_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM bookings
           WHERE business_id = $2 AND status = 'confirmed'
             AND start_time = $3::timestamp AND id <> $1
         )
       RETURNING id`,
      [req.params.id, req.business.id, startTs, endTs]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({ error: 'Taj termin je već zauzet.' });
    }
    res.json({ message: 'Termin premješten.' });
  })
);

module.exports = router;
