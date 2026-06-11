"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { api, ApiError } from "@/lib/api";

export default function CancelPage() {
  const token = useParams().token as string;
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleCancel() {
    setState("loading");
    try {
      const r = await api.cancelBooking(token);
      setMessage(r.when ? `Termin ${r.when} je otkazan.` : r.message);
      setState("done");
    } catch (err) {
      setMessage(
        err instanceof ApiError ? err.message : "Otkazivanje nije uspjelo.",
      );
      setState("error");
    }
  }

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md rounded-2xl border border-line bg-white p-8 text-center shadow-card">
        {state === "done" ? (
          <>
            <h1 className="font-display text-2xl font-medium">
              Rezervacija otkazana
            </h1>
            <p className="mt-2 text-ink-soft">{message}</p>
          </>
        ) : state === "error" ? (
          <>
            <h1 className="font-display text-2xl font-medium">Greška</h1>
            <p className="mt-2 text-ink-soft">{message}</p>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-medium">
              Otkazati rezervaciju?
            </h1>
            <p className="mt-2 text-ink-soft">
              Ova radnja je trajna. Termin će biti oslobođen za druge.
            </p>
            <button
              onClick={handleCancel}
              disabled={state === "loading"}
              className="btn-primary mt-6 w-full !bg-red-600 hover:!bg-red-700"
            >
              {state === "loading" ? "Otkazujem…" : "Da, otkaži termin"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
