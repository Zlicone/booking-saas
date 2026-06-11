"use client";

// Birač vremena s dva dropdowna (sat + minuta), uvijek 24-satni format.
// Radi neovisno o postavkama OS-a (za razliku od <input type="time">).
// Vrijednost se drži kao "HH:MM" string - isti format koji backend očekuje.

const HOURS = Array.from({ length: 24 }, (_, h) =>
  h.toString().padStart(2, "0"),
);
// Minute u koracima od 5 (00, 05, 10 ... 55)
const MINUTES = Array.from({ length: 12 }, (_, i) =>
  (i * 5).toString().padStart(2, "0"),
);

export function TimePicker({
  value,
  onChange,
}: {
  value: string; // "HH:MM"
  onChange: (next: string) => void;
}) {
  const [hh = "09", mm = "00"] = value.split(":");

  return (
    <span className="flex w-full items-center gap-1">
      <select
        aria-label="Sat"
        className="field-input flex-1 px-1 py-1.5 text-center"
        value={hh}
        onChange={(e) => onChange(`${e.target.value}:${mm}`)}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-ink-faint">:</span>
      <select
        aria-label="Minuta"
        className="field-input flex-1 px-1 py-1.5 text-center"
        value={mm}
        onChange={(e) => onChange(`${hh}:${e.target.value}`)}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}
