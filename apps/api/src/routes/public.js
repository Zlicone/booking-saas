const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { body } = require('express-validator');

const { query } = require('../db');
const { asyncHandler, validate } = require('../middleware/errorHandler');

// ============================================================
// Pomoćno: "HH:MM[:SS]" -> minute od ponoći
// ============================================================
const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
};
// minute od ponoći -> "HH:MM"
const toHHMM = (min) => {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
};

// ============================================================
// Pomoćno: generiraj sve termine za jedan raspored-dan
// Korak = trajanje termina + pauza. Termin mora STATI prije kraja.
// ============================================================
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

// ============================================================
// Pomoćno: day_of_week (0=ned..6=sub) iz "YYYY-MM-DD"
// Računamo preko UTC-a da izbjegnemo pomak ovisno o vremenskoj zoni.
// ============================================================
function dayOfWeek(dateStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Dohvati biznis po slugu (samo aktivni). Vraća red ili null.
async function findBusiness(slug) {
  const r = await query(
    `SELECT id, name, slug, description, primary_color, logo_url, is_active
     FROM businesses WHERE slug = $1`,
    [slug]
  );
  const b = r.rows[0];
  if (!b || !b.is_active) return null;
  return b;
}

// ============================================================
// GET /api/public/:slug
// Javne info o biznisu (za prikaz booking stranice).
// ============================================================
router.get('/:slug',
  asyncHandler(async (req, res) => {
    const b = await findBusiness(req.params.slug);
    if (!b) return res.status(404).json({ error: 'Stranica nije pronađena.' });

    res.json({
      business: {
        name: b.name,
        slug: b.slug,
        description: b.description,
        primaryColor: b.primary_color,
        logoUrl: b.logo_url,
      },
    });
  })
);

// ============================================================
// GET /api/public/:slug/slots?date=YYYY-MM-DD
// Slobodni termini za zadani datum.
// ============================================================
router.get('/:slug/slots',
  asyncHandler(async (req, res) => {
    const { date } = req.query;
    if (!date || !DATE_RE.test(date)) {
      return res.status(400).json({ error: 'Nedostaje ili neispravan datum (YYYY-MM-DD).' });
    }

    const b = await findBusiness(req.params.slug);
    if (!b) return res.status(404).json({ error: 'Stranica nije pronađena.' });

    // Ne dopuštamo datume u prošlosti
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (date < todayStr) {
      return res.json({ date, closed: true, slots: [] });
    }

    // Raspored za taj dan u tjednu
    const sched = await query(
      `SELECT is_active,
              to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time,   'HH24:MI') AS end_time,
              slot_duration, break_between
       FROM schedules
       WHERE business_id = $1 AND day_of_week = $2`,
      [b.id, dayOfWeek(date)]
    );
    const s = sched.rows[0];
    if (!s || !s.is_active) {
      return res.json({ date, closed: true, slots: [] });
    }

    let slots = generateSlots(s);

    // Makni već zauzete termine (potvrđene rezervacije tog dana)
    const booked = await query(
      `SELECT to_char(start_time, 'HH24:MI') AS t
       FROM bookings
       WHERE business_id = $1 AND status = 'confirmed' AND start_time::date = $2::date`,
      [b.id, date]
    );
    const takenSet = new Set(booked.rows.map((r) => r.t));
    slots = slots.filter((t) => !takenSet.has(t));

    // Ako je danas, makni termine koji su već prošli
    if (date === todayStr) {
      const nowMin = today.getHours() * 60 + today.getMinutes();
      slots = slots.filter((t) => toMinutes(t) > nowMin);
    }

    res.json({ date, closed: false, slots });
  })
);

// ============================================================
// POST /api/public/:slug/book
// Kreiraj rezervaciju (bez logina).
// Tijelo: { name, email, phone, date: "YYYY-MM-DD", time: "HH:MM" }
// ============================================================
router.post('/:slug/book',
  [
    body('name').trim().isLength({ min: 2, max: 255 }).withMessage('Ime je obavezno.'),
    body('email').isEmail().normalizeEmail().withMessage('Neispravan email.'),
    body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 50 }),
    body('date').matches(DATE_RE).withMessage('Neispravan datum.'),
    body('time').matches(TIME_RE).withMessage('Neispravno vrijeme.'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { name, email, phone, date, time } = req.body;

    const b = await findBusiness(req.params.slug);
    if (!b) return res.status(404).json({ error: 'Stranica nije pronađena.' });

    // Datum ne smije biti u prošlosti
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (date < todayStr) {
      return res.status(400).json({ error: 'Ne možete rezervirati termin u prošlosti.' });
    }

    // Provjeri raspored tog dana
    const sched = await query(
      `SELECT is_active,
              to_char(start_time, 'HH24:MI') AS start_time,
              to_char(end_time,   'HH24:MI') AS end_time,
              slot_duration, break_between
       FROM schedules
       WHERE business_id = $1 AND day_of_week = $2`,
      [b.id, dayOfWeek(date)]
    );
    const s = sched.rows[0];
    if (!s || !s.is_active) {
      return res.status(400).json({ error: 'Tog dana se ne radi.' });
    }

    // Je li traženi termin uopće valjan slot?
    if (!generateSlots(s).includes(time)) {
      return res.status(400).json({ error: 'Taj termin nije dostupan.' });
    }

    // Izračunaj početak i kraj kao timestamp
    const startMin = toMinutes(time);
    const endMin = startMin + s.slot_duration;
    const startTs = `${date} ${time}:00`;
    const endTs = `${date} ${toHHMM(endMin)}:00`;

    // Upsert klijenta (isti email = isti klijent za taj biznis)
    const clientRes = await query(
      `INSERT INTO clients (business_id, name, email, phone)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (business_id, email)
       DO UPDATE SET name = EXCLUDED.name,
                     phone = COALESCE(EXCLUDED.phone, clients.phone),
                     updated_at = NOW()
       RETURNING id, is_blocked`,
      [b.id, name, email, phone || null]
    );
    const client = clientRes.rows[0];
    if (client.is_blocked) {
      return res.status(403).json({ error: 'Rezervacija nije moguća. Kontaktirajte biznis.' });
    }

    // Ubaci rezervaciju SAMO ako termin još nije zauzet (atomična provjera)
    const cancelToken = uuidv4().replace(/-/g, '');
    const bookingRes = await query(
      `INSERT INTO bookings
         (business_id, client_id, start_time, end_time, duration_minutes, status, cancel_token)
       SELECT $1, $2, $3::timestamp, $4::timestamp, $5, 'confirmed', $6
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE business_id = $1 AND status = 'confirmed' AND start_time = $3::timestamp
       )
       RETURNING id, cancel_token`,
      [b.id, client.id, startTs, endTs, s.slot_duration, cancelToken]
    );

    if (bookingRes.rowCount === 0) {
      return res.status(409).json({ error: 'Netko je upravo rezervirao taj termin. Odaberite drugi.' });
    }

    // Osvježi brojač rezervacija klijenta
    await query(
      'UPDATE clients SET total_bookings = total_bookings + 1 WHERE id = $1',
      [client.id]
    );

    res.status(201).json({
      message: 'Rezervacija potvrđena!',
      booking: {
        id: bookingRes.rows[0].id,
        date,
        time,
        durationMinutes: s.slot_duration,
        cancelToken: bookingRes.rows[0].cancel_token,
      },
    });
  })
);

// ============================================================
// POST /api/public/cancel/:token
// Klijent otkazuje rezervaciju preko tokena (bez logina).
// ============================================================
router.post('/cancel/:token',
  asyncHandler(async (req, res) => {
    const r = await query(
      `UPDATE bookings
       SET status = 'canceled_by_client', canceled_at = NOW(), canceled_by = 'client'
       WHERE cancel_token = $1 AND status = 'confirmed'
       RETURNING id, to_char(start_time, 'DD.MM.YYYY. HH24:MI') AS when`,
      [req.params.token]
    );

    if (r.rowCount === 0) {
      return res.status(404).json({
        error: 'Rezervacija nije pronađena ili je već otkazana.',
      });
    }

    res.json({ message: 'Rezervacija je otkazana.', when: r.rows[0].when });
  })
);

module.exports = router;
