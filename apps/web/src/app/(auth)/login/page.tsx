"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      router.replace("/dashboard");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Prijava nije uspjela.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-medium">Dobrodošao natrag</h2>
      <p className="mt-1.5 text-ink-soft">Prijavi se u svoj panel.</p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="password">
            Lozinka
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="field-input"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Prijava…" : "Prijavi se"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Nemaš račun?{" "}
        <Link href="/register" className="font-medium text-brand-600 hover:text-brand-700">
          Registriraj biznis
        </Link>
      </p>
    </div>
  );
}
