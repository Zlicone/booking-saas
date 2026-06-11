import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      {/* Lijeva strana - brand panel (skriven na mobitelu) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand-500/40 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-amber-400/20 blur-3xl"
          aria-hidden
        />

        <Link href="/" className="relative flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 font-display text-lg">
            T
          </span>
          <span className="text-lg font-semibold tracking-tight">Termin</span>
        </Link>

        <div className="relative max-w-md">
          <h1 className="font-display text-4xl font-medium leading-tight">
            Tvoj raspored, tvoja stranica, tvoji termini.
          </h1>
          <p className="mt-4 text-white/70">
            Klijenti rezerviraju online bez registracije. Ti samo otvoriš
            laptop i vidiš cijeli tjedan na jednom mjestu.
          </p>
        </div>

        <p className="relative text-sm text-white/50">
          Za osobne trenere, frizere i kozmetičare.
        </p>
      </aside>

      {/* Desna strana - forma */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
