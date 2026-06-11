// Tipovi koji opisuju što backend (Korak 1) vraća.
// Ako se nazivi polja u tvojoj bazi razlikuju, prilagodi ovdje.

export interface Business {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  description?: string | null;
  primary_color?: string | null;
  slug?: string | null; // za personalni booking link (Korak 8)
  is_demo?: boolean; // demo račun (prijatelj) - bez naplate
  subscription_status?: "trial" | "active" | "past_due" | "canceled" | "paused" | string;
  trial_ends_at?: string | null;
  created_at?: string;
}

// Odgovor login/register endpointa
export interface AuthResponse {
  token: string;
  business: Business;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  phone: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

// --- Korak 3: Raspored ---
// Jedan dan tjednog rasporeda.
export interface ScheduleDay {
  dayOfWeek: number; // 0=nedjelja, 1=ponedjeljak ... 6=subota
  isActive: boolean; // radi li se taj dan
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  slotDuration: number; // trajanje termina u minutama
  breakBetween: number; // pauza između termina u minutama
}

// --- Korak 4: Javna booking stranica ---
export interface PublicBusiness {
  name: string;
  slug: string;
  description: string | null;
  primaryColor: string | null;
  logoUrl: string | null;
}

export interface SlotsResponse {
  date: string; // "YYYY-MM-DD"
  closed: boolean; // true ako se taj dan ne radi / prošlost
  slots: string[]; // ["09:00", "10:00", ...]
}

export interface BookingPayload {
  name: string;
  email: string;
  phone: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
}

export interface BookingConfirmation {
  id: string;
  date: string;
  time: string;
  durationMinutes: number;
  cancelToken: string;
}

// --- Korak 5: Kalendar / rezervacije (admin) ---
export interface Booking {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  endTime: string; // "HH:MM"
  durationMinutes: number;
  status: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
}

export interface DashboardStats {
  today: number;
  week: number;
  clients: number;
}

// --- Klijenti (admin) ---
export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  totalBookings: number;
  upcoming: number;
  isBlocked: boolean;
  notes: string | null;
  createdAt: string;
}
