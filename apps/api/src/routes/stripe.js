const express = require('express');
const router = express.Router();

const { query } = require('../db');
const { authenticateAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Lazy init - Stripe se učita tek kad treba (ne ruši app ako ključ fali)
let stripeClient = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!stripeClient) stripeClient = require('stripe')(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}
const FRONTEND = () => process.env.FRONTEND_URL || 'http://localhost:3000';

// ============================================================
// POST /api/stripe/checkout
// Kreira Stripe Checkout session za pretplatu i vraća URL.
// ============================================================
router.post('/checkout',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(400).json({ error: 'Stripe nije konfiguriran.' });
    if (!process.env.STRIPE_PRICE_ID) {
      return res.status(400).json({ error: 'STRIPE_PRICE_ID nije postavljen u .env.' });
    }

    const r = await query(
      `SELECT email, name, is_demo, subscription_status, stripe_customer_id
       FROM businesses WHERE id = $1`,
      [req.business.id]
    );
    const biz = r.rows[0];

    if (biz.is_demo) {
      return res.status(400).json({ error: 'Demo račun ne treba pretplatu.' });
    }
    if (biz.subscription_status === 'active') {
      return res.status(400).json({ error: 'Pretplata je već aktivna.' });
    }

    // Kreiraj Stripe korisnika ako ga nema
    let customerId = biz.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: biz.email,
        name: biz.name,
        metadata: { business_id: req.business.id },
      });
      customerId = customer.id;
      await query(
        'UPDATE businesses SET stripe_customer_id = $1 WHERE id = $2',
        [customerId, req.business.id]
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: `${FRONTEND()}/dashboard/settings?checkout=success`,
      cancel_url: `${FRONTEND()}/dashboard/settings?checkout=cancel`,
      metadata: { business_id: req.business.id },
    });

    res.json({ url: session.url });
  })
);

// ============================================================
// POST /api/stripe/portal
// Stripe Billing Portal - biznis upravlja/otkazuje pretplatu.
// ============================================================
router.post('/portal',
  authenticateAdmin,
  asyncHandler(async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(400).json({ error: 'Stripe nije konfiguriran.' });

    const r = await query(
      'SELECT stripe_customer_id FROM businesses WHERE id = $1',
      [req.business.id]
    );
    const customerId = r.rows[0].stripe_customer_id;
    if (!customerId) {
      return res.status(400).json({ error: 'Nema povezanog Stripe korisnika.' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND()}/dashboard/settings`,
    });

    res.json({ url: session.url });
  })
);

// ============================================================
// POST /api/stripe/webhook
// Stripe javlja promjene (plaćeno, otkazano...). Bez logina,
// ali provjeravamo potpis. Prima SIROVI body (vidi index.js).
// ============================================================
router.post('/webhook',
  asyncHandler(async (req, res) => {
    const stripe = getStripe();
    if (!stripe) return res.status(400).send('Stripe nije konfiguriran.');

    const sig = req.headers['stripe-signature'];
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[stripe] nevažeći webhook potpis:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      // Plaćanje uspješno -> aktiviraj pretplatu
      case 'checkout.session.completed': {
        const s = event.data.object;
        await query(
          `UPDATE businesses
           SET subscription_status = 'active', stripe_subscription_id = $2
           WHERE stripe_customer_id = $1`,
          [s.customer, s.subscription]
        );
        console.log('[stripe] pretplata aktivirana za customer', s.customer);
        break;
      }

      // Promjena pretplate (obnova, neuspjeh naplate...)
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status =
          sub.status === 'active' || sub.status === 'trialing' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : sub.status === 'canceled' ? 'canceled'
          : sub.status;
        await query(
          `UPDATE businesses
           SET subscription_status = $2,
               subscription_ends_at = to_timestamp($3)
           WHERE stripe_customer_id = $1`,
          [sub.customer, status, sub.current_period_end]
        );
        break;
      }

      // Pretplata otkazana / istekla
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await query(
          `UPDATE businesses SET subscription_status = 'canceled'
           WHERE stripe_customer_id = $1`,
          [sub.customer]
        );
        break;
      }

      default:
        // ostale evente ignoriramo
        break;
    }

    res.json({ received: true });
  })
);

module.exports = router;
