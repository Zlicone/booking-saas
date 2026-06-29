# Termin — aplikacija za rezervaciju termina

Booking / rezervacijski SaaS sustav za lokalne uslužne djelatnosti (osobni treneri, frizeri, kozmetičari). Biznis postavlja svoj raspored i dobiva vlastitu javnu stranicu na kojoj klijenti rezerviraju termine bez registracije.

**Završni rad** — Oblikovanje i implementacija aplikacije za rezervaciju termina za lokalne uslužne djelatnosti.

🔗 **Živa verzija:** https://booking-saas-web-beta.vercel.app

> Napomena: backend je na Render besplatnom planu koji "zaspi" nakon ~15 min neaktivnosti. Prvi otvor nakon toga može čekati 30–50 sekundi dok se servis ne probudi — to je normalno.

---

## Funkcionalnosti

### Admin strana (biznis)
- Registracija i prijava (JWT autentifikacija)
- Postavljanje rasporeda po danima: radno vrijeme, trajanje termina, pauza između klijenata
- Kalendar svih rezervacija s tjednim pregledom
- Otkazivanje i premještanje termina
- Pregled klijenata s poviješću, bilješkama i mogućnošću blokiranja
- Postavke profila (naziv, opis, boja stranice) i promjena lozinke
- Vlastiti booking link za dijeljenje klijentima

### Klijent strana
- Javna booking stranica bez registracije
- Odabir slobodnog termina koji se automatski računa iz rasporeda i već zauzetih termina
- Rezervacija unosom imena, e-maila i broja telefona
- Automatski e-mail podsjetnik ~24h prije termina
- Otkazivanje rezervacije putem osobnog linka

### Naplata
- 14 dana besplatnog probnog perioda za nove biznise
- Mjesečna pretplata (25 €) putem Stripe Checkouta
- Upravljanje i otkazivanje pretplate kroz Stripe Billing Portal
- Demo računi (besplatno, bez naplate)

---

## Tehnologije

| Sloj | Tehnologija |
|------|-------------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Node.js, Express |
| Baza | PostgreSQL |
| Autentifikacija | JWT, bcrypt |
| E-mail | Resend + node-cron (podsjetnici) |
| Naplata | Stripe (Checkout, Webhooks, Billing Portal) |
| Hosting | Vercel (frontend), Render (backend + baza) |

---

## Struktura projekta

Monorepo s dvije aplikacije:

```
booking-saas/
├── apps/
│   ├── api/                    # Express backend
│   │   └── src/
│   │       ├── db/             # schema.sql, migracije, konekcija
│   │       ├── middleware/     # autentifikacija, error handling
│   │       ├── routes/         # auth, schedule, bookings, clients,
│   │       │                   #   public, dashboard, profile,
│   │       │                   #   reminders, stripe
│   │       └── services/       # email (Resend), reminders (cron)
│   │
│   └── web/                    # Next.js frontend
│       └── src/
│           ├── app/            # rute (auth, dashboard, javni booking)
│           ├── components/
│           ├── lib/            # API klijent, auth kontekst, pretplata
│           └── types/
└── README.md
```

---

## Pokretanje lokalno

### Preduvjeti
- Node.js 18+
- PostgreSQL 14+

### 1. Kloniraj repozitorij
```bash
git clone https://github.com/Zlicone/booking-saas.git
cd booking-saas
```

### 2. Baza podataka
Kreiraj praznu bazu u PostgreSQL-u:
```sql
CREATE DATABASE booking_saas;
```

### 3. Backend (`apps/api`)
```bash
cd apps/api
npm install
cp .env.example .env          # popuni vrijednosti (vidi niže)
npm run migrate               # kreira tablice
npm run dev                   # http://localhost:3001
```

### 4. Frontend (`apps/web`)
U drugom terminalu:
```bash
cd apps/web
npm install
cp .env.local.example .env.local
npm run dev                   # http://localhost:3000
```

Aplikacija je dostupna na `http://localhost:3000`.

---

## Varijable okruženja

### `apps/api/.env`
```
DATABASE_URL=postgresql://korisnik:lozinka@localhost:5432/booking_saas

JWT_SECRET=<dugacki_nasumicni_niz>
JWT_EXPIRES_IN=7d

PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=                       # produkcijske domene, odvojene zarezom

RESEND_API_KEY=<resend_api_kljuc>
EMAIL_FROM=Termin <onboarding@resend.dev>

STRIPE_SECRET_KEY=<stripe_secret>
STRIPE_PRICE_ID=<stripe_price_id>
STRIPE_WEBHOOK_SECRET=<stripe_webhook_secret>
```

### `apps/web/.env.local`
```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> Stvarne vrijednosti ključeva nisu uključene u repozitorij. `.env` datoteke su izuzete preko `.gitignore`.

---

## Kako radi (ukratko)

**Rezervacija.** Biznis u rasporedu definira radne dane, satnicu, trajanje termina i pauzu. Iz toga backend računa slobodne termine za odabrani datum, oduzima već zauzete i one koji su prošli. Klijent na javnoj stranici (`/book/:slug`) odabire termin i rezervira; rezervacija se atomično sprema samo ako termin u tom trenutku još nije zauzet.

**Podsjetnici.** Cron zadatak svaki sat provjerava potvrđene termine u idućih 24 sata kojima podsjetnik još nije poslan i šalje e-mail putem Resenda, uz link za otkazivanje.

**Naplata.** Novi biznis ima 14 dana probnog perioda. Po isteku, pristup adminu otključava se Stripe pretplatom; webhook ažurira status u bazi nakon uspješnog plaćanja. Javna booking stranica radi neovisno o statusu pretplate.

---

## Deployment

- **Frontend** → Vercel (root: `apps/web`), s `NEXT_PUBLIC_API_URL` koji pokazuje na backend
- **Backend** → Render Web Service (root: `apps/api`, start: `npm start`)
- **Baza** → Render PostgreSQL
- **Stripe webhook** → konfiguriran na produkcijski backend URL
