"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/types";

function BookingLinkCard({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/book/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard nedostupan - korisnik može ručno kopirati */
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-line bg-white/70 p-5 shadow-card">
      <h2 className="font-display text-lg font-medium">Tvoj booking link</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Podijeli ovaj link klijentima — rezerviraju bez registracije.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <code className="flex-1 truncate rounded-xl border border-line bg-paper/60 px-3.5 py-2.5 text-sm">
          {url}
        </code>
        <div className="flex gap-2">
          <button onClick={copy} className="btn-primary shrink-0">
            {copied ? "Kopirano ✓" : "Kopiraj"}
          </button>
          <a
            href={`/book/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost shrink-0 border border-line"
          >
            Otvori
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/70 p-5 shadow-card">
      <div className="text-sm text-ink-faint">{label}</div>
      <div className="mt-1 font-display text-3xl font-medium">{value}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { business } = useAuth();
  const firstName = business?.name?.split(" ")[0] ?? "";
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats(null));
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8">
        <p className="text-sm text-ink-faint">Pregled</p>
        <h1 className="font-display text-3xl font-medium">
          Pozdrav, {firstName} 👋
        </h1>
        <p className="mt-1 text-ink-soft">
          Brzi pregled tvojih termina i klijenata.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Termini danas" value={stats ? stats.today : "—"} />
        <StatCard label="Ovaj tjedan" value={stats ? stats.week : "—"} />
        <StatCard label="Ukupno klijenata" value={stats ? stats.clients : "—"} />
      </section>

      {business?.slug && <BookingLinkCard slug={business.slug} />}

      <div className="mt-8 rounded-2xl border border-dashed border-line bg-white/40 p-8 text-center">
        <h2 className="font-display text-xl font-medium">Sljedeći korak</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
          Kalendar i rezervacije rade. U <strong>Koraku 6</strong> dodajemo
          automatske email podsjetnike klijentima 24h prije termina.
        </p>
      </div>
    </div>
  );
}
