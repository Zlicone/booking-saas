-- Korak 7: Stripe stupci na businesses tablici.
-- Idempotentno - sigurno za ponovno pokretanje (IF NOT EXISTS).

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_customer_id     VARCHAR(255);
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
