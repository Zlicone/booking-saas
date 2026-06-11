"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import type { Booking } from "@/types";

// --- Datumski helperi ---
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function mondayOf(date: Date): Date {
  const x = new Date(date);
  const day = (x.getDay() + 6) % 7; // 0 = ponedjeljak
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
const DAY_FULL = new Intl.DateTimeFormat("hr-HR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const RANGE = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "short" });

export default function CalendarPage() {
  const { business } = useAuth();
  const slug = business?.slug ?? "";

  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reschedule, setReschedule] = useState<Booking | null>(null);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayStr = ymd(new Date());

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .getBookings(ymd(weekStart), ymd(addDays(weekStart, 6)))
      .then(setBookings)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Greška pri učitavanju."),
      )
      .finally(() => setLoading(false));
  }, [weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCancel(b: Booking) {
    if (!confirm(`Otkazati termin ${b.time} — ${b.clientName}?`)) return;
    try {
      await api.cancelBookingAdmin(b.id);
      load();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "Otkazivanje nije uspjelo.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-sm text-ink-faint">Kalendar</p>
        <h1 className="font-display text-3xl font-medium">Rezervacije</h1>
      </header>

      {/* Navigacija po tjednu */}
      <div className="mb-6 flex items-center justify-between">
        <div className="text-sm font-medium text-ink-soft">
          {RANGE.format(weekStart)} – {RANGE.format(addDays(weekStart, 6))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="btn-ghost border border-line px-3"
            aria-label="Prethodni tjedan"
          >
            ‹
          </button>
          <button
            onClick={() => setWeekStart(mondayOf(new Date()))}
            className="btn-ghost border border-line"
          >
            Danas
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="btn-ghost border border-line px-3"
            aria-label="Sljedeći tjedan"
          >
            ›
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          {weekDays.map((day) => {
            const dStr = ymd(day);
            const dayBookings = (bookings ?? []).filter((b) => b.date === dStr);
            const isToday = dStr === todayStr;
            return (
              <div key={dStr}>
                <div className="mb-2 flex items-center gap-2">
                  <h2
                    className={`text-sm font-medium capitalize ${isToday ? "text-brand-600" : "text-ink-soft"}`}
                  >
                    {DAY_FULL.format(day)}
                  </h2>
                  {isToday && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      danas
                    </span>
                  )}
                </div>

                {dayBookings.length === 0 ? (
                  <p className="rounded-xl border border-line bg-white/40 px-4 py-3 text-sm text-ink-faint">
                    Nema rezervacija
                  </p>
                ) : (
                  <div className="space-y-2">
                    {dayBookings.map((b) => (
                      <div
                        key={b.id}
                        className="flex flex-col gap-3 rounded-xl border border-line bg-white/70 p-4 shadow-card sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-center">
                            <div className="font-display text-lg font-medium leading-none">
                              {b.time}
                            </div>
                            <div className="text-xs text-ink-faint">
                              {b.endTime}
                            </div>
                          </div>
                          <div className="border-l border-line pl-4">
                            <div className="font-medium">{b.clientName}</div>
                            <div className="text-sm text-ink-faint">
                              {b.clientPhone || b.clientEmail}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setReschedule(b)}
                            className="btn-ghost border border-line text-sm"
                          >
                            Premjesti
                          </button>
                          <button
                            onClick={() => handleCancel(b)}
                            className="btn-ghost border border-line text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            Otkaži
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {reschedule && (
        <RescheduleModal
          slug={slug}
          booking={reschedule}
          onClose={() => setReschedule(null)}
          onDone={() => {
            setReschedule(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal za premještanje termina
// ============================================================
function RescheduleModal({
  slug,
  booking,
  onClose,
  onDone,
}: {
  slug: string;
  booking: Booking;
  onClose: () => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState(booking.date);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug || !date) return;
    setLoadingSlots(true);
    setTime(null);
    api
      .getSlots(slug, date)
      .then((r) => setSlots(r.closed ? [] : r.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, date]);

  async function save() {
    if (!time) return;
    setSaving(true);
    setError(null);
    try {
      await api.rescheduleBooking(booking.id, date, time);
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Premještanje nije uspjelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift">
        <h2 className="font-display text-xl font-medium">Premjesti termin</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {booking.clientName} — trenutno {booking.date} u {booking.time}
        </p>

        <label className="field-label mt-4">Novi datum</label>
        <input
          type="date"
          className="field-input"
          value={date}
          min={ymd(new Date())}
          onChange={(e) => setDate(e.target.value)}
        />

        <label className="field-label mt-4">Novi termin</label>
        {loadingSlots ? (
          <div className="grid place-items-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand-600" />
          </div>
        ) : slots && slots.length === 0 ? (
          <p className="rounded-xl bg-paper/60 px-3 py-4 text-center text-sm text-ink-faint">
            Nema slobodnih termina tog dana.
          </p>
        ) : (
          <div className="grid max-h-44 grid-cols-4 gap-2 overflow-y-auto">
            {slots?.map((t) => (
              <button
                key={t}
                onClick={() => setTime(t)}
                className={`rounded-lg border py-2 text-sm font-medium transition ${
                  t === time
                    ? "border-transparent bg-brand-600 text-white"
                    : "border-line hover:border-brand-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost border border-line">
            Odustani
          </button>
          <button
            onClick={save}
            disabled={!time || saving}
            className="btn-primary"
          >
            {saving ? "Premještam…" : "Premjesti"}
          </button>
        </div>
      </div>
    </div>
  );
}
