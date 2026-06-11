const express = require('express');
const router = express.Router();

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// ============================================================
// Pomoćno: validacija jednog dana u rasporedu
// Vraća string s greškom ili null ako je sve OK.
// ============================================================
function validateDay(d) {
  if (typeof d.dayOfWeek !== 'number' || d.dayOfWeek < 0 || d.dayOfWeek > 6) {
    return 'dayOfWeek mora biti broj 0-6';
  }
  if (typeof d.isActive !== 'boolean') {
    return 'isActive mora biti true/false';
  }
  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/; // "HH:MM"
  if (!timeRegex.test(d.startTime) || !timeRegex.test(d.endTime)) {
    return 'startTime i endTime moraju biti u formatu HH:MM';
  }
  if (![30, 45, 60, 90, 120].includes(d.slotDuration)) {
    return 'slotDuration mora biti 30, 45, 60, 90 ili 120';
  }
  if (typeof d.breakBetween !== 'number' || d.breakBetween < 0 || d.breakBetween > 60) {
    return 'breakBetween mora biti broj 0-60';
  }
  // Za radne dane: kraj mora biti poslije početka
  if (d.isActive && d.startTime >= d.endTime) {
    return 'Kraj radnog vremena mora biti poslije početka';
  }
  return null;
}

// ============================================================
// GET /api/schedule
// Dohvati cijeli tjedni raspored prijavljenog biznisa.
// Vraćamo poredano Pon -> Ned, vremena u formatu "HH:MM".
// ============================================================
router.get('/',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const result = await query(`
      SELECT
        day_of_week                       AS "dayOfWeek",
        is_active                         AS "isActive",
        to_char(start_time, 'HH24:MI')    AS "startTime",
        to_char(end_time,   'HH24:MI')    AS "endTime",
        slot_duration                     AS "slotDuration",
        break_between                     AS "breakBetween"
      FROM schedules
      WHERE business_id = $1
      ORDER BY CASE WHEN day_of_week = 0 THEN 7 ELSE day_of_week END
    `, [req.business.id]);

    res.json({ days: result.rows });
  })
);

// ============================================================
// PUT /api/schedule
// Spremi cijeli tjedan odjednom.
// Tijelo: { days: [ { dayOfWeek, isActive, startTime, endTime, slotDuration, breakBetween }, ... ] }
//
// Koristimo UPSERT: ako red za (business_id, day_of_week) postoji -> update,
// ako ne -> insert. Sve u JEDNOJ SQL naredbi = atomično.
// ============================================================
router.put('/',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const days = req.body.days;

    if (!Array.isArray(days) || days.length === 0) {
      return res.status(400).json({ error: 'Tijelo mora sadržavati niz "days".' });
    }

    // Validiraj svaki dan
    for (const d of days) {
      const err = validateDay(d);
      if (err) return res.status(400).json({ error: err });
    }

    // Spriječi duplikate istog dana u zahtjevu
    const seen = new Set();
    for (const d of days) {
      if (seen.has(d.dayOfWeek)) {
        return res.status(400).json({ error: `Dan ${d.dayOfWeek} je naveden dvaput.` });
      }
      seen.add(d.dayOfWeek);
    }

    // Sastavi parametrizirani višeredni UPSERT
    const COLS = 7; // business_id, day_of_week, is_active, start_time, end_time, slot_duration, break_between
    const values = [];
    const placeholders = days.map((d, i) => {
      const b = i * COLS;
      values.push(
        req.business.id,
        d.dayOfWeek,
        d.isActive,
        d.startTime,
        d.endTime,
        d.slotDuration,
        d.breakBetween
      );
      return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
    }).join(', ');

    const result = await query(`
      INSERT INTO schedules
        (business_id, day_of_week, is_active, start_time, end_time, slot_duration, break_between)
      VALUES ${placeholders}
      ON CONFLICT (business_id, day_of_week)
      DO UPDATE SET
        is_active     = EXCLUDED.is_active,
        start_time    = EXCLUDED.start_time,
        end_time      = EXCLUDED.end_time,
        slot_duration = EXCLUDED.slot_duration,
        break_between = EXCLUDED.break_between,
        updated_at    = NOW()
      RETURNING
        day_of_week                       AS "dayOfWeek",
        is_active                         AS "isActive",
        to_char(start_time, 'HH24:MI')    AS "startTime",
        to_char(end_time,   'HH24:MI')    AS "endTime",
        slot_duration                     AS "slotDuration",
        break_between                     AS "breakBetween"
    `, values);

    // Poredaj rezultat Pon -> Ned za konzistentan odgovor
    const order = (dow) => (dow === 0 ? 7 : dow);
    const sorted = result.rows.sort((a, b) => order(a.dayOfWeek) - order(b.dayOfWeek));

    res.json({ message: 'Raspored spremljen.', days: sorted });
  })
);

module.exports = router;
