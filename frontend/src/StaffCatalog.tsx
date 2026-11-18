import React from "react";
import type { FormEvent } from "react";
import { apiBase } from "./staff-auth";

type Package = {
  code: string;
  name: string;
  duration_minutes: number;
  price_centavos: number;
};

export default function StaffCatalog({ token }: { token: string }) {
  const [packages, setPackages] = React.useState<Package[]>([]);
  const [selected, setSelected] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  async function load(signal?: AbortSignal) {
    const response = await fetch(`${apiBase}/catalog`, { signal });
    if (!response.ok) throw new Error();
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error();
    setPackages(rows as Package[]);
  }
  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setMessage("Current rates are unavailable.");
    });
    return () => controller.abort();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    const item = packages.find(
      (row) => `${row.code}:${row.duration_minutes}` === selected,
    );
    const amount = Number(price);
    if (!item || !Number.isSafeInteger(amount) || amount < 0) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/staff/catalog/package-price`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryCode: item.code,
          durationMinutes: item.duration_minutes,
          priceCentavos: amount,
        }),
      });
      if (!response.ok) throw new Error();
      await load();
      setMessage("Rate updated and audited.");
    } catch {
      setMessage("Rate update failed. Check staff access and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 border-t border-subtle pt-6">
      <h2 className="text-lg font-bold">Package rates</h2>
      <p className="mt-1 text-sm text-muted">
        Changes create a new price version. Earlier versions remain stored.
      </p>
      <form onSubmit={(event) => void save(event)} className="mt-5 space-y-4">
        <label className="block text-sm font-medium">
          Package
          <select
            required
            className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
            value={selected}
            onChange={(event) => {
              setSelected(event.target.value);
              const item = packages.find(
                (row) =>
                  `${row.code}:${row.duration_minutes}` === event.target.value,
              );
              setPrice(item ? String(item.price_centavos) : "");
            }}
          >
            <option value="">Choose a package</option>
            {packages.map((item) => (
              <option
                key={`${item.code}:${item.duration_minutes}`}
                value={`${item.code}:${item.duration_minutes}`}
              >
                {item.name} · {item.duration_minutes / 60} hours
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium">
          Price in centavos
          <input
            required
            min="0"
            step="1"
            type="number"
            className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </label>
        <button
          disabled={busy || !selected}
          className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save price"}
        </button>
      </form>
      {message && (
        <p aria-live="polite" className="mt-3 text-sm text-muted">
          {message}
        </p>
      )}
    </section>
  );
}
