"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(form);
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Registracija nije uspjela.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-medium">Otvori svoj biznis</h2>
      <p className="mt-1.5 text-ink-soft">14 dana besplatno, bez kartice.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="field-label" htmlFor="name">
            Naziv biznisa / ime
          </label>
          <input
            id="name"
            required
            className="field-input"
            placeholder="Ivan Horvat — Personalni trening"
            value={form.name}
            onChange={update("name")}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="field-input"
            placeholder="ime@biznis.hr"
            value={form.email}
            onChange={update("email")}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="phone">
            Telefon
          </label>
          <input
            id="phone"
            type="tel"
            autoComplete="tel"
            required
            className="field-input"
            placeholder="091 234 5678"
            value={form.phone}
            onChange={update("phone")}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            Lozinka
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="field-input"
            placeholder="Minimalno 8 znakova"
            value={form.password}
            onChange={update("password")}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Kreiram račun…" : "Kreiraj račun"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Već imaš račun?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Prijavi se
        </Link>
      </p>
    </div>
  );
}
