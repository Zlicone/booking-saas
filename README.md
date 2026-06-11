# 📅 Booking SaaS

SaaS sustav za rezervacije termina (osobni treneri, frizeri, kozmetičari).

## Stack
- **Frontend**: Next.js 14
- **Backend**: Node.js + Express
- **Baza**: PostgreSQL
- **Naplata**: Stripe
- **Email**: Nodemailer (Gmail SMTP)

---

## 🚀 Pokretanje (Korak 1)

### 1. Kloniraj i instaliraj dependencies

```bash
git clone ...
cd booking-saas

# Instaliraj root dependencies
npm install

# Instaliraj API dependencies
cd apps/api
npm install
cd ../..
```

### 2. Postavi PostgreSQL bazu

```bash
# Kreiraj bazu (u psql)
psql -U postgres
CREATE DATABASE booking_saas;
\q
```

### 3. Konfiguriraj environment varijable

```bash
cd apps/api
cp .env.example .env
# Uredi .env i postavi DATABASE_URL, JWT_SECRET, itd.
```

### 4. Pokreni migraciju

```bash
npm run migrate
```

Output:
```
🚀 Pokretanje migracije baze...
✅ Migracija uspješna! Sve tablice su kreirane.

📋 Tablice u bazi:
   • booking_details (view)
   • bookings
   • businesses
   • clients
   • schedule_exceptions
   • schedules
```

### 5. Pokreni API server

```bash
npm run dev:api
```

Output:
```
🚀 API server pokrenut na http://localhost:3001
📋 Health check: http://localhost:3001/health
🌍 Okruženje: development
```

---

## 📡 API Endpoints (Korak 1)

### Auth

| Method | Path | Opis |
|--------|------|------|
| POST | `/api/auth/register` | Registracija biznisa |
| POST | `/api/auth/login` | Prijava |
| GET | `/api/auth/me` | Trenutni korisnik |
| POST | `/api/auth/forgot-password` | Zahtjev za reset lozinke |
| POST | `/api/auth/reset-password` | Reset lozinke s tokenom |
| PATCH | `/api/auth/change-password` | Promjena lozinke (auth) |

### Test s curl

```bash
# Registracija
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "lozinka123",
    "name": "Ivan Horvat PT",
    "phone": "091 234 5678"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ivan@example.com",
    "password": "lozinka123"
  }'

# Dohvati profil (koristi token iz login odgovora)
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 📁 Struktura projekta

```
booking-saas/
├── apps/
│   ├── api/                    # Node.js backend
│   │   └── src/
│   │       ├── db/
│   │       │   ├── index.js    # DB connection pool
│   │       │   ├── schema.sql  # Kompletna shema
│   │       │   └── migrate.js  # Migration runner
│   │       ├── middleware/
│   │       │   ├── auth.js     # JWT middleware
│   │       │   └── errorHandler.js
│   │       ├── routes/
│   │       │   └── auth.js     # Auth rute (Korak 1)
│   │       └── index.js        # Express app
│   └── web/                    # Next.js frontend (Korak 2)
└── package.json                # Monorepo config
```

---

## 🗺️ Roadmap

- [x] **Korak 1**: Struktura projekta, baza, auth
- [ ] **Korak 2**: Next.js frontend + login/register stranice
- [ ] **Korak 3**: Raspored (Schedule management)
- [ ] **Korak 4**: Booking stranica za klijente
- [ ] **Korak 5**: Kalendar prikaz rezervacija
- [ ] **Korak 6**: Email podsjetnici (cron job)
- [ ] **Korak 7**: Stripe naplata pretplate
- [ ] **Korak 8**: Subdomain routing (ime-trenera.domena.com)
