// Email servis preko Resend-a.
// Ako RESEND_API_KEY nije postavljen, slanje se preskače (ne ruši app).

let resendClient = null;

function getClient() {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) {
    // Lazy require - paket se učita tek kad stvarno treba
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// U test modu (bez verificirane domene) Resend dopušta slanje
// samo s 'onboarding@resend.dev' i to na email tvog Resend računa.
const FROM = process.env.EMAIL_FROM || 'Termin <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  const client = getClient();
  if (!client) {
    console.warn('[email] RESEND_API_KEY nije postavljen — email se NE šalje.');
    return { skipped: true };
  }

  const { error } = await client.emails.send({ from: FROM, to, subject, html });
  if (error) {
    throw new Error(error.message || 'Resend greška pri slanju.');
  }
  return { sent: true };
}

// HTML za podsjetnik 24h prije termina
function reminderHtml({ businessName, clientName, date, time, durationMinutes, cancelUrl }) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1A1816;">
    <h2 style="color:#13544A; margin-bottom: 4px;">Podsjetnik na termin</h2>
    <p style="color:#4A463F;">Bok ${clientName}, podsjećamo te na rezervaciju kod <strong>${businessName}</strong>:</p>
    <div style="background:#FAF7F2; border:1px solid #E7E0D4; border-radius:12px; padding:16px 20px; margin:16px 0;">
      <p style="margin:0; font-size:18px;"><strong>${date}</strong> u <strong>${time}</strong></p>
      <p style="margin:4px 0 0; color:#8A8478;">Trajanje: ${durationMinutes} min</p>
    </div>
    <p style="color:#4A463F;">Ne možeš doći? Otkaži ovdje da oslobodiš termin:</p>
    <p><a href="${cancelUrl}" style="color:#13544A;">${cancelUrl}</a></p>
    <p style="color:#8A8478; font-size:12px; margin-top:24px;">Vidimo se!</p>
  </div>`;
}

module.exports = { sendEmail, reminderHtml };
