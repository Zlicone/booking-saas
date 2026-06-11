const cron = require('node-cron');
const { query } = require('../db');
const { sendEmail, reminderHtml } = require('./email');

// ============================================================
// Pošalji podsjetnike za sve potvrđene termine u idućih 24h
// kojima podsjetnik još nije poslan. Vraća broj poslanih.
// ============================================================
async function runReminders() {
  const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';

  const result = await query(`
    SELECT
      b.id,
      b.cancel_token,
      b.duration_minutes,
      to_char(b.start_time, 'DD.MM.YYYY.') AS date,
      to_char(b.start_time, 'HH24:MI')     AS time,
      c.name  AS client_name,
      c.email AS client_email,
      biz.name AS business_name
    FROM bookings b
    JOIN clients c    ON c.id = b.client_id
    JOIN businesses biz ON biz.id = b.business_id
    WHERE b.status = 'confirmed'
      AND b.reminder_24h_sent = false
      AND b.start_time > NOW()
      AND b.start_time <= NOW() + INTERVAL '24 hours'
  `);

  let sent = 0;
  for (const r of result.rows) {
    const cancelUrl = `${FRONTEND}/book/cancel/${r.cancel_token}`;
    try {
      const res = await sendEmail({
        to: r.client_email,
        subject: `Podsjetnik: termin ${r.date} u ${r.time}`,
        html: reminderHtml({
          businessName: r.business_name,
          clientName: r.client_name,
          date: r.date,
          time: r.time,
          durationMinutes: r.duration_minutes,
          cancelUrl,
        }),
      });

      // Označi poslanim SAMO ako je email stvarno otišao
      if (res.sent) {
        await query(
          'UPDATE bookings SET reminder_24h_sent = true WHERE id = $1',
          [r.id]
        );
        sent++;
      }
    } catch (e) {
      console.error(`[reminders] greška za booking ${r.id}:`, e.message);
      // Ne označavamo poslanim -> pokušat će ponovo na sljedećem ciklusu
    }
  }

  return sent;
}

// ============================================================
// Pokreni cron koji svaki sak (u :00) šalje podsjetnike.
// ============================================================
function startReminderCron() {
  // '0 * * * *' = svake pune sata
  cron.schedule('0 * * * *', () => {
    runReminders()
      .then((n) => {
        if (n > 0) console.log(`[reminders] poslano podsjetnika: ${n}`);
      })
      .catch((e) => console.error('[reminders] cron greška:', e.message));
  });
  console.log('⏰ Reminder cron aktivan (provjera svaki sat).');
}

module.exports = { runReminders, startReminderCron };
