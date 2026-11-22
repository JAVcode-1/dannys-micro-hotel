import React from "react";
import type { FormEvent } from "react";
import { notifySuccess } from "./notifications";
import { parsePesoInput, pesoInputValue } from "./peso-input";
import { apiBase } from "./staff-auth";

type Package = {
  code: string;
  name: string;
  duration_minutes: number;
  price_centavos: number;
  version?: number;
  active?: boolean;
  category_active?: boolean;
};

export default function StaffCatalog({ token }: { token: string }) {
  const [packages, setPackages] = React.useState<Package[]>([]);
  const [selected, setSelected] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [history, setHistory] = React.useState<Package[]>([]);
  const [categoryNames, setCategoryNames] = React.useState<
    Record<string, string>
  >({});
  async function saveCategory(item: Package) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/staff/catalog/categories`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryCode: item.code,
          name: categoryNames[item.code] ?? item.name,
          active: item.category_active,
        }),
      });
      if (!response.ok) throw new Error();
      notifySuccess("Category name updated.");
      await load();
      setMessage("Category name updated and audited.");
    } catch {
      setMessage("Category update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function toggleCategory(item: Package) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/staff/catalog/categories`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryCode: item.code,
          name: item.name,
          active: !item.category_active,
        }),
      });
      if (!response.ok) throw new Error();
      notifySuccess("Category availability updated.");
      await load();
      setMessage("Category availability updated and audited.");
    } catch {
      setMessage("Category update failed.");
    } finally {
      setBusy(false);
    }
  }
  async function load(signal?: AbortSignal) {
    const response = await fetch(`${apiBase}/staff/catalog`, {
      signal,
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error();
    const rows: unknown = await response.json();
    if (!Array.isArray(rows)) throw new Error();
    setHistory(rows as Package[]);
    setPackages(
      (rows as Package[]).filter((row) => row.active && row.category_active),
    );
  }
  async function toggle(item: Package) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`${apiBase}/staff/catalog/packages`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          categoryCode: item.code,
          durationMinutes: item.duration_minutes,
          active: !item.active,
        }),
      });
      if (!response.ok) throw new Error();
      notifySuccess("Package availability updated.");
      await load();
      setMessage("Package availability updated and audited.");
    } catch {
      setMessage("Package update failed.");
    } finally {
      setBusy(false);
    }
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
    let amount: number;
    try {
      amount = parsePesoInput(price);
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    if (!item) return;
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
      notifySuccess("Room rate updated.");
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
      <div className="my-5 space-y-3">
        <h3 className="font-semibold">Room categories</h3>
        {history
          .filter(
            (item, index, rows) =>
              rows.findIndex((row) => row.code === item.code) === index,
          )
          .map((item) => (
            <form
              key={item.code}
              className="flex flex-wrap items-end gap-3 rounded border border-subtle p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void saveCategory(item);
              }}
            >
              <label className="min-w-0 flex-1">
                Category name
                <input
                  className="block min-h-11 w-full rounded border px-3 text-base"
                  required
                  maxLength={80}
                  value={categoryNames[item.code] ?? item.name}
                  onChange={(event) =>
                    setCategoryNames((names) => ({
                      ...names,
                      [item.code]: event.target.value,
                    }))
                  }
                />
              </label>
              <button disabled={busy} className="min-h-11 rounded border px-3">
                Save category name
              </button>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded border px-3"
                onClick={() => void toggleCategory(item)}
              >
                {item.category_active
                  ? "Deactivate category"
                  : "Activate category"}
              </button>
            </form>
          ))}
      </div>
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
              setPrice(item ? pesoInputValue(item.price_centavos) : "");
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
          Price (PHP)
          <input
            required
            min="0"
            inputMode="decimal"
            placeholder="₱1,000.00"
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
      <h3 className="mt-8 font-bold">Catalog versions</h3>
      <ul className="mt-3 divide-y divide-subtle text-sm">
        {history.map((item) => (
          <li
            key={`${item.code}:${item.duration_minutes}:${item.version}`}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <span>
              {item.name} · {item.duration_minutes / 60} hours · v{item.version}{" "}
              · ₱
              {(item.price_centavos / 100).toLocaleString("en-PH", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              · {item.active ? "Active" : "Inactive"}
            </span>
            {item.version ===
              Math.max(
                ...history
                  .filter(
                    (row) =>
                      row.code === item.code &&
                      row.duration_minutes === item.duration_minutes,
                  )
                  .map((row) => row.version ?? 0),
              ) && (
              <button
                disabled={busy}
                onClick={() => void toggle(item)}
                className="min-h-11 rounded-lg border border-primary px-3 text-primary disabled:opacity-50"
              >
                {item.active ? "Deactivate" : "Activate"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p aria-live="polite" className="mt-3 text-sm text-muted">
          {message}
        </p>
      )}
    </section>
  );
}
