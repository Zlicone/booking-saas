-- ============================================================
-- BOOKING SAAS - Kompletna shema baze podataka
-- Verzija: 1.0
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- BUSINESSES (Admini — treneri, frizeri, kozmetičari)
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  
  -- Profil
  name          VARCHAR(255) NOT NULL,           -- Ime biznisa (npr. "Ivan Horvat - PT")
  slug          VARCHAR(100) UNIQUE NOT NULL,     -- URL slug (npr. "ivan-horvat")
  description   TEXT,                             -- Opis usluge
  phone         VARCHAR(50),
  
  -- Branding
  primary_color VARCHAR(7) DEFAULT '#6366f1',    -- Hex boja za booking stranicu
  logo_url      VARCHAR(500),
  
  -- Status
  is_active     BOOLEAN DEFAULT true,
  is_demo       BOOLEAN DEFAULT false,            -- Prijatelj = besplatno zauvijek
  
  -- Email verifikacija
  email_verified         BOOLEAN DEFAULT false,
  email_verify_token     VARCHAR(255),
  email_verify_expires   TIMESTAMP,
  
  -- Password reset
  reset_token            VARCHAR(255),
  reset_token_expires    TIMESTAMP,
  
  -- Stripe
  stripe_customer_id     VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  subscription_status    VARCHAR(50) DEFAULT 'trial',
  -- trial | active | past_due | canceled | paused
  trial_ends_at          TIMESTAMP DEFAULT (NOW() + INTERVAL '14 days'),
  subscription_ends_at   TIMESTAMP,
  
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- SCHEDULES (Radno vrijeme biznisa)
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  -- 0=Nedjelja, 1=Ponedjeljak, ..., 6=Subota
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_active     BOOLEAN DEFAULT true,             -- Je li taj dan radni
  
  start_time    TIME NOT NULL,                    -- npr. 08:00
  end_time      TIME NOT NULL,                    -- npr. 20:00
  slot_duration INTEGER NOT NULL DEFAULT 60,      -- Trajanje termina u minutama (30, 45, 60, 90...)
  break_between INTEGER NOT NULL DEFAULT 0,       -- Pauza između termina u minutama
  
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(business_id, day_of_week)
);

-- ============================================================
-- SCHEDULE EXCEPTIONS (Izvanredni slobodni dani / posebno radno vrijeme)
-- ============================================================
CREATE TABLE IF NOT EXISTS schedule_exceptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  exception_date DATE NOT NULL,
  is_closed      BOOLEAN DEFAULT true,            -- true = slobodan dan, false = posebno radno vrijeme
  
  -- Koristiti samo ako is_closed = false
  start_time    TIME,
  end_time      TIME,
  note          VARCHAR(255),                     -- npr. "Državni praznik" / "Kraći radni dan"
  
  created_at    TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(business_id, exception_date)
);

-- ============================================================
-- CLIENTS (Klijenti koji rezerviraju)
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL,
  phone         VARCHAR(50),
  
  -- Unikatan client po biznisu (isti email = isti klijent za taj biznis)
  UNIQUE(business_id, email),
  
  notes         TEXT,                             -- Admin može dodati bilješku o klijentu
  is_blocked    BOOLEAN DEFAULT false,
  
  total_bookings INTEGER DEFAULT 0,              -- Denormalizirano za brzi prikaz
  
  created_at    TIMESTAMP DEFAULT NOW(),
  updated_at    TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- BOOKINGS (Rezervacije)
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  
  -- Termin
  start_time      TIMESTAMP NOT NULL,
  end_time        TIMESTAMP NOT NULL,
  duration_minutes INTEGER NOT NULL,
  
  -- Status
  status          VARCHAR(50) DEFAULT 'confirmed',
  -- confirmed | canceled_by_client | canceled_by_business | completed | no_show
  
  -- Otkazivanje
  canceled_at     TIMESTAMP,
  canceled_by     VARCHAR(20),                    -- 'client' | 'business'
  cancel_reason   TEXT,
  
  -- Posebni token za klijenta da može otkazati bez logina
  cancel_token    VARCHAR(255) UNIQUE,
  
  -- Email podsjetnici
  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent  BOOLEAN DEFAULT false,
  
  -- Admin bilješka
  notes           TEXT,
  
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- INDEKSI za performanse
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bookings_business_start ON bookings(business_id, start_time);
CREATE INDEX IF NOT EXISTS idx_bookings_client ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_cancel_token ON bookings(cancel_token);
CREATE INDEX IF NOT EXISTS idx_bookings_reminder ON bookings(start_time, reminder_24h_sent) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_clients_business_email ON clients(business_id, email);
CREATE INDEX IF NOT EXISTS idx_businesses_slug ON businesses(slug);
CREATE INDEX IF NOT EXISTS idx_schedule_business ON schedules(business_id);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER businesses_updated_at
  BEFORE UPDATE ON businesses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER schedules_updated_at
  BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- VIEWS (korisni prikazi)
-- ============================================================

-- Aktivne rezervacije s podacima o klijentu i biznisu
CREATE OR REPLACE VIEW booking_details AS
SELECT
  b.id,
  b.start_time,
  b.end_time,
  b.duration_minutes,
  b.status,
  b.notes,
  b.cancel_token,
  b.created_at,
  -- Client podaci
  c.id          AS client_id,
  c.name        AS client_name,
  c.email       AS client_email,
  c.phone       AS client_phone,
  -- Business podaci
  bus.id        AS business_id,
  bus.name      AS business_name,
  bus.slug      AS business_slug
FROM bookings b
JOIN clients c ON c.id = b.client_id
JOIN businesses bus ON bus.id = b.business_id;
