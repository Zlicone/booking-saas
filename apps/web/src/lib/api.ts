import type {
  AuthResponse,
  Booking,
  Business,
  BookingConfirmation,
  BookingPayload,
  Client,
  DashboardStats,
  LoginPayload,
  PublicBusiness,
  RegisterPayload,
  ScheduleDay,
  SlotsResponse,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const TOKEN_KEY = "booking_token";

// --- Upravljanje tokenom (localStorage) ---
export const tokenStore = {
  get(): string | null {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY);
  },
  set(token: string) {
    window.localStorage.setItem(TOKEN_KEY, token);
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY);
  },
};

// Greška koja nosi HTTP status + poruku s backenda
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Centralni fetch wrapper - dodaje JSON headere + Bearer token
async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = tokenStore.get();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  // Pokušaj parsirati JSON tijelo (može biti prazno)
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data as { error?: string; message?: string })?.error ??
      (data as { message?: string })?.message ??
      `Greška ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

// Backend miješa snake_case (/me) i camelCase (login) za business objekt.
// Ovdje sve svodimo na jedan oblik koji frontend očekuje.
function normalizeBusiness(b: Record<string, unknown>): Business {
  const get = (a: string, b2: string) => (b[a] ?? b[b2]) as never;
  return {
    id: b.id as string,
    email: b.email as string,
    name: b.name as string,
    phone: (b.phone ?? null) as string | null,
    description: (b.description ?? null) as string | null,
    primary_color: (get("primary_color", "primaryColor") ?? null) as string | null,
    slug: (b.slug ?? null) as string | null,
    is_demo: get("is_demo", "isDemo") ?? false,
    subscription_status: get("subscription_status", "subscriptionStatus"),
    trial_ends_at: get("trial_ends_at", "trialEndsAt") ?? null,
    created_at: b.created_at as string | undefined,
  };
}

// --- API pozivi (mapiraju na rute iz Koraka 1 + 3) ---
export const api = {
  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const data = await request<{ token: string; business: Record<string, unknown> }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return { token: data.token, business: normalizeBusiness(data.business) };
  },

  async login(payload: LoginPayload): Promise<AuthResponse> {
    const data = await request<{ token: string; business: Record<string, unknown> }>(
      "/api/auth/login",
      { method: "POST", body: JSON.stringify(payload) },
    );
    return { token: data.token, business: normalizeBusiness(data.business) };
  },

  // GET /api/auth/me - backend vraća { business } (snake_case)
  async me(): Promise<Business> {
    const data = await request<{ business: Record<string, unknown> }>("/api/auth/me");
    return normalizeBusiness(data.business);
  },

  // --- Korak 3: Raspored ---
  async getSchedule(): Promise<ScheduleDay[]> {
    const data = await request<{ days: ScheduleDay[] }>("/api/schedule");
    return data.days;
  },

  async saveSchedule(days: ScheduleDay[]): Promise<ScheduleDay[]> {
    const data = await request<{ days: ScheduleDay[] }>("/api/schedule", {
      method: "PUT",
      body: JSON.stringify({ days }),
    });
    return data.days;
  },

  // --- Korak 4: Javna booking stranica (bez logina) ---
  async getPublicBusiness(slug: string): Promise<PublicBusiness> {
    const data = await request<{ business: PublicBusiness }>(
      `/api/public/${slug}`,
    );
    return data.business;
  },

  getSlots(slug: string, date: string): Promise<SlotsResponse> {
    return request<SlotsResponse>(`/api/public/${slug}/slots?date=${date}`);
  },

  async createBooking(
    slug: string,
    payload: BookingPayload,
  ): Promise<BookingConfirmation> {
    const data = await request<{ booking: BookingConfirmation }>(
      `/api/public/${slug}/book`,
      { method: "POST", body: JSON.stringify(payload) },
    );
    return data.booking;
  },

  cancelBooking(token: string): Promise<{ message: string; when: string }> {
    return request<{ message: string; when: string }>(
      `/api/public/cancel/${token}`,
      { method: "POST" },
    );
  },

  // --- Korak 5: Kalendar / rezervacije (admin) ---
  async getBookings(from: string, to: string): Promise<Booking[]> {
    const data = await request<{ bookings: Booking[] }>(
      `/api/bookings?from=${from}&to=${to}`,
    );
    return data.bookings;
  },

  cancelBookingAdmin(id: string, reason?: string): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/bookings/${id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason }),
    });
  },

  rescheduleBooking(
    id: string,
    date: string,
    time: string,
  ): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/bookings/${id}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify({ date, time }),
    });
  },

  getStats(): Promise<DashboardStats> {
    return request<DashboardStats>("/api/dashboard/stats");
  },

  // --- Klijenti (admin) ---
  async getClients(): Promise<Client[]> {
    const data = await request<{ clients: Client[] }>("/api/clients");
    return data.clients;
  },

  async updateClient(
    id: string,
    patch: { isBlocked?: boolean; notes?: string },
  ): Promise<void> {
    await request(`/api/clients/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  // --- Postavke ---
  async updateProfile(patch: {
    name?: string;
    description?: string;
    phone?: string;
    primaryColor?: string;
  }): Promise<void> {
    await request("/api/profile", {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    return request<{ message: string }>("/api/auth/change-password", {
      method: "PATCH",
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // --- Korak 6: Email podsjetnici ---
  sendTestEmail(): Promise<{ message: string }> {
    return request<{ message: string }>("/api/reminders/test", {
      method: "POST",
    });
  },

  runReminders(): Promise<{ message: string; sent: number }> {
    return request<{ message: string; sent: number }>("/api/reminders/run", {
      method: "POST",
    });
  },

  // --- Korak 7: Stripe pretplata ---
  async createCheckout(): Promise<string> {
    const data = await request<{ url: string }>("/api/stripe/checkout", {
      method: "POST",
    });
    return data.url;
  },

  async openBillingPortal(): Promise<string> {
    const data = await request<{ url: string }>("/api/stripe/portal", {
      method: "POST",
    });
    return data.url;
  },
};
