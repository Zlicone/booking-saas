"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { hasAccess, trialDaysLeft } from "@/lib/subscription";

export default function SettingsPage() {
  const { business, refresh } = useAuth();

  // Povratak sa Stripe Checkouta -> osvježi status
  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("checkout");
    if (r === "success") {
      setCheckoutMsg("Plaćanje uspješno! Pretplata se aktivira…");
      // Webhook treba sekundu da postavi status - osvježi par puta
      refresh();
      const t = setTimeout(refresh, 2500);
      window.history.replaceState({}, "", "/dashboard/settings");
      return () => clearTimeout(t);
    }
    if (r === "cancel") {
      setCheckoutMsg("Plaćanje otkazano.");
      window.history.replaceState({}, "", "/dashboard/settings");
    }
  }, [refresh]);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <p className="text-sm text-ink-faint">Postavke</p>
        <h1 className="font-display text-3xl font-medium">Postavke računa</h1>
      </header>

      {checkoutMsg && (
        <div className="mb-6 rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {checkoutMsg}
        </div>
      )}

      {business && <SubscriptionSection />}

      {business && (
        <ProfileForm
          initial={{
            name: business.name ?? "",
            description: business.description ?? "",
            phone: business.phone ?? "",
            primaryColor: business.primary_color ?? "#13544A",
          }}
          onSaved={refresh}
        />
      )}

      <PasswordForm />

      <RemindersSection />
    </div>
  );
}

// ============================================================
// Sekcija: Pretplata
// ============================================================
function SubscriptionSection() {
  const { business } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!business) return null;

  const isDemo = business.is_demo;
  const isActive = business.subscription_status === "active";
  const isTrial = business.subscription_status === "trial";
  const days = trialDaysLeft(business);
  const access = hasAccess(business);

  async function go(action: "checkout" | "portal") {
    setLoading(true);
    setError(null);
    try {
      const url =
        action === "checkout"
          ? await api.createCheckout()
          : await api.openBillingPortal();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Greška.");
      setLoading(false);
    }
  }

  let statusLabel: string;
  let statusClass: string;
  if (isDemo) {
    statusLabel = "Demo račun — besplatno";
    statusClass = "text-amber-500";
  } else if (isActive) {
    statusLabel = "Pretplata aktivna";
    statusClass = "text-brand-600";
  } else if (isTrial && access) {
    statusLabel = `Probni period — ${days} ${days === 1 ? "dan" : "dana"} preostalo`;
    statusClass = "text-brand-700";
  } else {
    statusLabel = "Probni period istekao";
    statusClass = "text-red-700";
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-white/70 p-6 shadow-card">
      <h2 className="font-display text-xl font-medium">Pretplata</h2>
      <p className={`mt-1 text-sm font-medium ${statusClass}`}>{statusLabel}</p>

      {!isDemo && (
        <div className="mt-4 flex flex-wrap gap-2">
          {isActive ? (
            <button
              onClick={() => go("portal")}
              disabled={loading}
              className="btn-ghost border border-line"
            >
              {loading ? "Otvaram…" : "Upravljaj pretplatom"}
            </button>
          ) : (
            <button
              onClick={() => go("checkout")}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Otvaram…" : "Pretplati se — 25€/mj"}
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>
  );
}

// ============================================================
// Forma: profil biznisa
// ============================================================
function ProfileForm({
  initial,
  onSaved,
}: {
  initial: {
    name: string;
    description: string;
    phone: string;
    primaryColor: string;
  };
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function set<K extends keyof typeof form>(key: K, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
    setMsg(null);
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.updateProfile(form);
      await onSaved();
      setMsg({ ok: true, text: "Profil spremljen." });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Spremanje nije uspjelo.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-white/70 p-6 shadow-card">
      <h2 className="font-display text-xl font-medium">Profil biznisa</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Ovo klijenti vide na tvojoj booking stranici.
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label">Naziv / ime</label>
          <input
            className="field-input"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">Opis</label>
          <textarea
            className="field-input min-h-20 resize-y"
            placeholder="npr. Personalni trening i prehrana. Studio u centru."
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">Telefon</label>
          <input
            className="field-input"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">Boja stranice</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              className="h-10 w-14 cursor-pointer rounded-lg border border-line bg-white p-1"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
            />
            <input
              className="field-input w-32 font-mono"
              value={form.primaryColor}
              onChange={(e) => set("primaryColor", e.target.value)}
            />
            <span
              className="ml-auto rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: form.primaryColor }}
            >
              Pregled
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-sm" aria-live="polite">
          {msg && (
            <span className={msg.ok ? "text-brand-600" : "text-red-700"}>
              {msg.ok ? "✓ " : ""}
              {msg.text}
            </span>
          )}
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Spremam…" : "Spremi profil"}
        </button>
      </div>
    </section>
  );
}

// ============================================================
// Forma: promjena lozinke
// ============================================================
function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: "Nova lozinka mora imati min. 8 znakova." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "Lozinke se ne podudaraju." });
      return;
    }
    setSaving(true);
    try {
      await api.changePassword(current, next);
      setMsg({ ok: true, text: "Lozinka promijenjena." });
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Promjena nije uspjela.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white/70 p-6 shadow-card">
      <h2 className="font-display text-xl font-medium">Promjena lozinke</h2>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label">Trenutna lozinka</label>
          <input
            type="password"
            className="field-input"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Nova lozinka</label>
          <input
            type="password"
            className="field-input"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <label className="field-label">Ponovi novu lozinku</label>
          <input
            type="password"
            className="field-input"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="text-sm" aria-live="polite">
          {msg && (
            <span className={msg.ok ? "text-brand-600" : "text-red-700"}>
              {msg.ok ? "✓ " : ""}
              {msg.text}
            </span>
          )}
        </div>
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? "Mijenjam…" : "Promijeni lozinku"}
        </button>
      </div>
    </section>
  );
}

// ============================================================
// Sekcija: Email podsjetnici (test)
// ============================================================
function RemindersSection() {
  const [busy, setBusy] = useState<"test" | "run" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function testEmail() {
    setBusy("test");
    setMsg(null);
    try {
      const r = await api.sendTestEmail();
      setMsg({ ok: true, text: r.message });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Slanje nije uspjelo.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function runNow() {
    setBusy("run");
    setMsg(null);
    try {
      const r = await api.runReminders();
      setMsg({ ok: true, text: r.message });
    } catch (e) {
      setMsg({
        ok: false,
        text: e instanceof ApiError ? e.message : "Provjera nije uspjela.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-line bg-white/70 p-6 shadow-card">
      <h2 className="font-display text-xl font-medium">Email podsjetnici</h2>
      <p className="mt-1 text-sm text-ink-soft">
        Klijenti automatski dobiju podsjetnik ~24h prije termina. Ovdje možeš
        testirati da slanje radi.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={testEmail}
          disabled={busy !== null}
          className="btn-ghost border border-line"
        >
          {busy === "test" ? "Šaljem…" : "Pošalji test email"}
        </button>
        <button
          onClick={runNow}
          disabled={busy !== null}
          className="btn-ghost border border-line"
        >
          {busy === "run" ? "Provjeravam…" : "Pokreni provjeru sada"}
        </button>
      </div>

      {msg && (
        <p
          className={`mt-3 text-sm ${msg.ok ? "text-brand-600" : "text-red-700"}`}
          aria-live="polite"
        >
          {msg.ok ? "✓ " : ""}
          {msg.text}
        </p>
      )}
    </section>
  );
}
