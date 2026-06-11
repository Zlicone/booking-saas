"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import type {
  BookingConfirmation,
  PublicBusiness,
} from "@/types";

// --- Pomoćne funkcije za datume ---
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextDays(count: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}
const WEEKDAY = new Intl.DateTimeFormat("hr-HR", { weekday: "short" });
const DAYMON = new Intl.DateTimeFormat("hr-HR", { day: "numeric", month: "short" });
const FULLDATE = new Intl.DateTimeFormat("hr-HR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export default function BookingPage() {
  const slug = useParams().slug as string;

  const [biz, setBiz] = useState<PublicBusiness | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const days = nextDays(21);
  const [selectedDate, setSelectedDate] = useState<string>(ymd(days[0]));
  const [slots, setSlots] = useState<string[] | null>(null);
  const [closed, setClosed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [done, setDone] = useState<BookingConfirmation | null>(null);

  const accent = biz?.primaryColor || "#13544A";

  // Učitaj biznis po slugu
  useEffect(() => {
    api
      .getPublicBusiness(slug)
      .then(setBiz)
      .catch((e) =>
        setLoadErr(
          e instanceof ApiError && e.status === 404
            ? "Ova stranica ne postoji."
            : "Greška pri učitavanju.",
        ),
      );
  }, [slug]);

  // Dohvati slobodne termine za odabrani datum
  const loadSlots = useCallback(
    (date: string) => {
      setLoadingSlots(true);
      setSelectedTime(null);
      api
        .getSlots(slug, date)
        .then((r) => {
          setSlots(r.slots);
          setClosed(r.closed);
        })
        .catch(() => {
          setSlots([]);
          setClosed(false);
        })
        .finally(() => setLoadingSlots(false));
    },
    [slug],
  );

  useEffect(() => {
    if (biz) loadSlots(selectedDate);
  }, [biz, selectedDate, loadSlots]);

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTime) return;
    setFormErr(null);
    setSubmitting(true);
    try {
      const confirmation = await api.createBooking(slug, {
        ...form,
        date: selectedDate,
        time: selectedTime,
      });
      setDone(confirmation);
    } catch (err) {
      setFormErr(
        err instanceof ApiError ? err.message : "Rezervacija nije uspjela.",
      );
      // Ako je termin upravo zauzet, osvježi listu
      if (err instanceof ApiError && err.status === 409) loadSlots(selectedDate);
    } finally {
      setSubmitting(false);
    }
  }

  // --- Stanja stranice ---
  if (loadErr) {
    return (
      <Centered>
        <h1 className="font-display text-2xl font-medium">{loadErr}</h1>
        <p className="mt-2 text-ink-soft">Provjeri link i pokušaj ponovno.</p>
      </Centered>
    );
  }

  if (!biz) {
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      </Centered>
    );
  }

  // Potvrda rezervacije
  if (done) {
    const cancelUrl = `/book/cancel/${done.cancelToken}`;
    return (
      <Centered>
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
          <div
            className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white"
            style={{ backgroundColor: accent }}
          >
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h1 className="mt-4 font-display text-2xl font-medium">
            Termin rezerviran!
          </h1>
          <p className="mt-2 text-ink-soft">
            {FULLDATE.format(new Date(done.date + "T00:00:00"))} u{" "}
            <strong>{done.time}</strong> ({done.durationMinutes} min)
          </p>
          <p className="mt-1 text-sm text-ink-faint">kod {biz.name}</p>

          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm text-ink-soft">
              Trebaš otkazati? Sačuvaj ovaj link:
            </p>
            <a
              href={cancelUrl}
              className="mt-1 block break-all text-sm font-medium text-brand-600 hover:underline"
            >
              {cancelUrl}
            </a>
          </div>
        </div>
      </Centered>
    );
  }

  // Glavni booking ekran
  return (
    <div className="relative z-10 mx-auto min-h-screen max-w-lg px-5 py-10">
      <header className="mb-8 text-center">
        <h1 className="font-display text-3xl font-medium">{biz.name}</h1>
        {biz.description && (
          <p className="mt-2 text-ink-soft">{biz.description}</p>
        )}
        <p className="mt-1 text-sm text-ink-faint">Odaberi termin za rezervaciju</p>
      </header>

      {/* Odabir datuma */}
      <div className="mb-2 text-sm font-medium text-ink-soft">Datum</div>
      <div className="-mx-1 mb-6 flex gap-2 overflow-x-auto px-1 pb-2">
        {days.map((d) => {
          const v = ymd(d);
          const active = v === selectedDate;
          return (
            <button
              key={v}
              onClick={() => setSelectedDate(v)}
              className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 transition ${
                active
                  ? "border-transparent text-white"
                  : "border-line bg-white text-ink hover:border-brand-400"
              }`}
              style={active ? { backgroundColor: accent } : undefined}
            >
              <span className="text-xs capitalize opacity-80">
                {WEEKDAY.format(d)}
              </span>
              <span className="text-sm font-medium">{DAYMON.format(d)}</span>
            </button>
          );
        })}
      </div>

      {/* Termini */}
      <div className="mb-2 text-sm font-medium text-ink-soft">Termin</div>
      {loadingSlots ? (
        <div className="grid place-items-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-600" />
        </div>
      ) : closed ? (
        <p className="rounded-xl bg-white/60 px-4 py-6 text-center text-ink-faint">
          Tog dana se ne radi.
        </p>
      ) : slots && slots.length === 0 ? (
        <p className="rounded-xl bg-white/60 px-4 py-6 text-center text-ink-faint">
          Nema slobodnih termina za ovaj dan.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots?.map((t) => {
            const active = t === selectedTime;
            return (
              <button
                key={t}
                onClick={() => setSelectedTime(t)}
                className={`rounded-xl border py-2.5 text-sm font-medium transition ${
                  active
                    ? "border-transparent text-white"
                    : "border-line bg-white text-ink hover:border-brand-400"
                }`}
                style={active ? { backgroundColor: accent } : undefined}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}

      {/* Forma - prikazuje se kad je termin odabran */}
      {selectedTime && (
        <form
          onSubmit={handleBook}
          className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-card"
        >
          <p className="mb-4 text-sm text-ink-soft">
            Rezervacija za{" "}
            <strong className="text-ink">
              {FULLDATE.format(new Date(selectedDate + "T00:00:00"))}
            </strong>{" "}
            u <strong className="text-ink">{selectedTime}</strong>
          </p>

          {formErr && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {formErr}
            </div>
          )}

          <div className="space-y-3">
            <input
              className="field-input"
              placeholder="Ime i prezime"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              type="email"
              className="field-input"
              placeholder="Email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              type="tel"
              className="field-input"
              placeholder="Broj telefona"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="mt-4 w-full rounded-xl py-2.5 font-medium text-white transition active:scale-[0.99] disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {submitting ? "Rezerviram…" : "Potvrdi rezervaciju"}
          </button>
        </form>
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 text-center">
      {children}
    </div>
  );
}
