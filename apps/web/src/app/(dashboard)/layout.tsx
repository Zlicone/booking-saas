"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError } from "@/lib/api";
import { hasAccess, trialDaysLeft } from "@/lib/subscription";
import { Sidebar } from "@/components/sidebar";
import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { business, loading, logout } = useAuth();
  const router = useRouter();

  // Zaštita rute: ako nismo prijavljeni, baci na /login
  useEffect(() => {
    if (!loading && !business) router.replace("/login");
  }, [loading, business, router]);

  // Dok provjeravamo token ili preusmjeravamo -> spinner
  if (loading || !business) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      </div>
    );
  }

  const isTrial = business.subscription_status === "trial";
  const isDemo = business.is_demo;
  const access = hasAccess(business);
  const daysLeft = trialDaysLeft(business);

  return (
    <div className="relative z-10 flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-white/60 px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-600 font-display text-lg text-white">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight">Termin</span>
        </div>

        <div className="mt-8 flex-1">
          <Sidebar />
        </div>

        {/* Račun / status */}
        <div className="border-t border-line pt-4">
          {isDemo ? (
            <span className="mb-3 inline-flex rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-500">
              Demo račun
            </span>
          ) : isTrial ? (
            <span className="mb-3 inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
              Probni period
            </span>
          ) : null}

          <div className="truncate text-sm font-medium">{business.name}</div>
          <div className="truncate text-xs text-ink-faint">{business.email}</div>
          <button onClick={logout} className="btn-ghost mt-2 w-full justify-start px-2">
            Odjava
          </button>
        </div>
      </aside>

      {/* Glavni sadržaj */}
      <main className="flex-1 px-6 py-8 sm:px-10">
        {access ? (
          <>
            {isTrial && !isDemo && <TrialBanner daysLeft={daysLeft} />}
            {children}
          </>
        ) : (
          <Paywall />
        )}
      </main>
    </div>
  );
}

// Traka koja se vidi tijekom triala
function TrialBanner({ daysLeft }: { daysLeft: number }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3">
      <p className="text-sm text-ink">
        Probni period: <strong>{daysLeft}</strong>{" "}
        {daysLeft === 1 ? "dan" : "dana"} preostalo.
      </p>
      <a
        href="/dashboard/settings"
        className="text-sm font-medium text-brand-700 hover:underline"
      >
        Pretplati se →
      </a>
    </div>
  );
}

// Zaključani ekran kad trial istekne (i nije plaćeno)
function Paywall() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setLoading(true);
    setError(null);
    try {
      const url = await api.createCheckout();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Greška pri pretplati.");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-md place-items-center text-center">
      <div>
        <h1 className="font-display text-3xl font-medium">Probni period je istekao</h1>
        <p className="mt-3 text-ink-soft">
          Za nastavak korištenja admin panela potrebna je pretplata —{" "}
          <strong>25€/mjesec</strong>. Tvoja booking stranica i dalje radi za
          klijente.
        </p>
        <button
          onClick={subscribe}
          disabled={loading}
          className="btn-primary mt-6"
        >
          {loading ? "Otvaram…" : "Pretplati se"}
        </button>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
