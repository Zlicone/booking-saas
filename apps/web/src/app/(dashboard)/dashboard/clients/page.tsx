"use client";

import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Client } from "@/types";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Client | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api
      .getClients()
      .then(setClients)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Greška pri učitavanju."),
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q),
    );
  }, [clients, search]);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-sm text-ink-faint">Klijenti</p>
        <h1 className="font-display text-3xl font-medium">
          Tvoji klijenti{clients ? ` (${clients.length})` : ""}
        </h1>
      </header>

      {!loading && clients && clients.length > 0 && (
        <input
          className="field-input mb-5 max-w-sm"
          placeholder="Pretraži po imenu, emailu ili telefonu…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {loading ? (
        <div className="grid place-items-center py-20">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-line border-t-brand-600" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : clients && clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white/40 p-10 text-center">
          <p className="text-ink-soft">Još nemaš klijenata.</p>
          <p className="mt-1 text-sm text-ink-faint">
            Pojavit će se ovdje čim netko rezervira preko tvog linka.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white/70 shadow-card">
          {filtered.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className={`flex w-full items-center gap-4 px-4 py-3 text-left transition hover:bg-brand-50/50 ${
                i !== filtered.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-medium text-brand-700">
                {initials(c.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-medium">
                  <span className="truncate">{c.name}</span>
                  {c.isBlocked && (
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      blokiran
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-ink-faint">
                  {c.phone || c.email}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-medium">{c.totalBookings}</span>
                <span className="text-xs text-ink-faint">termina</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-ink-faint">
              Nema rezultata za “{search}”.
            </p>
          )}
        </div>
      )}

      {selected && (
        <ClientModal
          client={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// Modal s detaljima klijenta
// ============================================================
function ClientModal({
  client,
  onClose,
  onSaved,
}: {
  client: Client;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState(client.notes ?? "");
  const [blocked, setBlocked] = useState(client.isBlocked);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api.updateClient(client.id, { isBlocked: blocked, notes });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Spremanje nije uspjelo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lift">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 font-medium text-brand-700">
            {initials(client.name)}
          </span>
          <div>
            <h2 className="font-display text-xl font-medium">{client.name}</h2>
            <p className="text-sm text-ink-faint">klijent od {client.createdAt}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-paper/60 px-3 py-2">
            <div className="text-ink-faint">Email</div>
            <div className="truncate font-medium">{client.email}</div>
          </div>
          <div className="rounded-xl bg-paper/60 px-3 py-2">
            <div className="text-ink-faint">Telefon</div>
            <div className="font-medium">{client.phone || "—"}</div>
          </div>
          <div className="rounded-xl bg-paper/60 px-3 py-2">
            <div className="text-ink-faint">Ukupno termina</div>
            <div className="font-medium">{client.totalBookings}</div>
          </div>
          <div className="rounded-xl bg-paper/60 px-3 py-2">
            <div className="text-ink-faint">Nadolazećih</div>
            <div className="font-medium">{client.upcoming}</div>
          </div>
        </div>

        <label className="field-label mt-5">Bilješka (vidiš samo ti)</label>
        <textarea
          className="field-input min-h-20 resize-y"
          placeholder="npr. ozljeda koljena, preferira jutarnje termine…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <label className="mt-4 flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={blocked}
            onChange={(e) => setBlocked(e.target.checked)}
            className="h-4 w-4 accent-red-600"
          />
          <span className="text-sm">
            Blokiraj klijenta
            <span className="block text-xs text-ink-faint">
              Blokiran klijent ne može rezervirati nove termine.
            </span>
          </span>
        </label>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost border border-line">
            Zatvori
          </button>
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? "Spremam…" : "Spremi"}
          </button>
        </div>
      </div>
    </div>
  );
}
