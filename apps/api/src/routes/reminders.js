const express = require('express');
const router = express.Router();

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { runReminders } = require('../services/reminders');
const { sendEmail } = require('../services/email');

// ============================================================
// POST /api/reminders/run
// Ručno pokreni provjeru podsjetnika (ista logika kao cron).
// Korisno za testiranje bez čekanja punog sata.
// ============================================================
router.post('/run',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const sent = await runReminders();
    res.json({ message: `Provjera gotova. Poslano podsjetnika: ${sent}.`, sent });
  })
);

// ============================================================
// POST /api/reminders/test
// Pošalji test email na vlastiti email (provjera Resend postavki).
// ============================================================
router.post('/test',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const r = await query('SELECT email FROM businesses WHERE id = $1', [req.business.id]);
    const email = r.rows[0].email;

    const result = await sendEmail({
      to: email,
      subject: 'Test — Termin podsjetnici rade',
      html: '<p style="font-family:sans-serif">Ako vidiš ovo, Resend je ispravno postavljen. 🎉</p>',
    });

    if (result.skipped) {
      return res.status(400).json({ error: 'RESEND_API_KEY nije postavljen u .env.' });
    }
    res.json({ message: `Test email poslan na ${email}. Provjeri inbox (i spam).` });
  })
);

module.exports = router;
