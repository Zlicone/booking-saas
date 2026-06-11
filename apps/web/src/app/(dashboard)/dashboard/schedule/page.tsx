"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { TimePicker } from "@/components/time-picker";
import type { ScheduleDay } from "@/types";

// Redoslijed prikaza: Pon -> Ned (0=nedjelja stoji zadnji)
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABELS: Record<number, string> = {
  1: "Ponedjeljak",
  2: "Utorak",
  3: "Srijeda",
  4: "Četvrtak",
  5: "Petak",
  6: "Subota",
  0: "Nedjelja",
};

const SLOT_OPTIONS = [30, 45, 60, 90, 120];
const BREAK_OPTIONS = [0, 5, 10, 15, 30];

// Poredaj dohvaćene dane u Pon->Ned redoslijed
function sortDays(days: ScheduleDay[]): ScheduleDay[] {
  return [...days].sort(
    (a, b) => DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek),
  );
}

export default function SchedulePage() {
  const [days, setDays] = useState<ScheduleDay[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Učitaj raspored na otvaranju stranice
  useEffect(() => {
    api
      .getSchedule()
      .then((d) => setDays(sortDays(d)))
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Greška pri učitavanju.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  // Promijeni jedno polje za određeni dan
  function updateDay(dayOfWeek: number, patch: Partial<ScheduleDay>) {
    setSaved(false);
    setDays((prev) =>
      prev
        ? prev.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d))
        : prev,
    );
  }

  async function handleSave() {
    if (!days) return;
    setError(null);
    setSaved(false);

    // Frontend provjera: za radne dane kraj mora biti poslije početka
    const bad = days.find((d) => d.isActive && d.startTime >= d.endTime);
    if (bad) {
      setError(
        `${DAY_LABELS[bad.dayOfWeek]}: kraj radnog vremena mora biti poslije početka.`,
      );
      return;
    }

    setSaving(true);
    try {
      const updated = await api.saveSchedule(days);
      setDays(sortDays(updated));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Spremanje nije uspjelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-8">
        <p className="text-sm text-ink-faint">Raspored</p>
        <h1 className="font-display text-3xl font-medium">Radno vrijeme</h1>
        <p className="mt-1 text-ink-soft">
          Uključi dane kad radiš i postavi radno vrijeme. Za svaki dan odrediš
          koliko traje jedan termin i koliko pauze ostavljaš između klijenata —
          iz toga se automatski računaju slobodni termini koje klijenti vide.
        </p>
      </header>

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand-600" />
        </div>
      ) : !days ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? "Raspored nije dostupan."}
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-line bg-white/70 shadow-card">
            {/* Zaglavlje s nazivima kolona (samo na širem ekranu) */}
            <div className="hidden border-b border-line bg-paper/50 px-5 py-2.5 text-xs font-medium uppercase leading-tight tracking-wide text-ink-faint sm:flex sm:items-center">
              <span className="w-40 shrink-0">Dan</span>
              <span className="flex items-center gap-x-2">
                <span className="w-[6.5rem]">Početak</span>
                <span className="w-3" />
                <span className="w-[6.5rem]">Kraj</span>
                <span className="w-28">Trajanje termina</span>
                <span className="w-32">Pauza između klijenata</span>
              </span>
            </div>

            {days.map((day, i) => (
              <div
                key={day.dayOfWeek}
                className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${
                  i !== days.length - 1 ? "border-b border-line" : ""
                } ${day.isActive ? "" : "bg-paper/40"}`}
              >
                {/* Toggle + naziv dana */}
                <label className="flex w-40 shrink-0 cursor-pointer items-center gap-3">
                  <span className="relative inline-flex h-6 w-11 items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={day.isActive}
                      onChange={(e) =>
                        updateDay(day.dayOfWeek, { isActive: e.target.checked })
                      }
                    />
                    <span className="absolute inset-0 rounded-full bg-line transition peer-checked:bg-brand-500" />
                    <span className="absolute left-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
                  </span>
                  <span
                    className={`font-medium ${day.isActive ? "text-ink" : "text-ink-faint"}`}
                  >
                    {DAY_LABELS[day.dayOfWeek]}
                  </span>
                </label>

                {/* Postavke dana (samo ako je radni) */}
                {day.isActive ? (
                  <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-end sm:gap-x-2">
                    <label className="flex flex-col gap-1 sm:w-[6.5rem]">
                      <span className="text-xs text-ink-faint sm:hidden">Početak</span>
                      <TimePicker
                        value={day.startTime}
                        onChange={(v) => updateDay(day.dayOfWeek, { startTime: v })}
                      />
                    </label>

                    <span className="hidden w-3 pb-1.5 text-center text-ink-faint sm:block">
                      –
                    </span>

                    <label className="flex flex-col gap-1 sm:w-[6.5rem]">
                      <span className="text-xs text-ink-faint sm:hidden">Kraj</span>
                      <TimePicker
                        value={day.endTime}
                        onChange={(v) => updateDay(day.dayOfWeek, { endTime: v })}
                      />
                    </label>

                    <label className="flex flex-col gap-1 sm:w-28">
                      <span className="text-xs text-ink-faint sm:hidden">
                        Trajanje termina
                      </span>
                      <select
                        className="field-input px-2 py-1.5"
                        value={day.slotDuration}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, {
                            slotDuration: Number(e.target.value),
                          })
                        }
                      >
                        {SLOT_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m} min
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 sm:w-32">
                      <span className="text-xs text-ink-faint sm:hidden">
                        Pauza između klijenata
                      </span>
                      <select
                        className="field-input px-2 py-1.5"
                        value={day.breakBetween}
                        onChange={(e) =>
                          updateDay(day.dayOfWeek, {
                            breakBetween: Number(e.target.value),
                          })
                        }
                      >
                        {BREAK_OPTIONS.map((m) => (
                          <option key={m} value={m}>
                            {m === 0 ? "bez pauze" : `${m} min`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <span className="text-sm text-ink-faint">Neradni dan</span>
                )}
              </div>
            ))}
          </div>

          {/* Greška / potvrda + gumb */}
          <div className="mt-5 flex items-center justify-between gap-4">
            <div aria-live="polite" className="text-sm">
              {error && <span className="text-red-700">{error}</span>}
              {saved && !error && (
                <span className="text-brand-600">✓ Raspored spremljen.</span>
              )}
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? "Spremam…" : "Spremi raspored"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
