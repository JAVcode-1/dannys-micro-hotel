import React from "react";
import { apiBase } from "./staff-auth";
import PaymentQrSettings from "./PaymentQrSettings";

type Settings = {
  cleaningBufferMinutes: number | null;
  checkoutAlertMinutes: number | null;
  checkoutWarningMinutes?: number[] | null;
  gcashQrObjectKey: string | null;
  gcashPayeeLabel: string | null;
  cancellationDisplayText: string | null;
};

export default function OperationalSettings({ token }: { token: string }) {
  const [value, setValue] = React.useState<Settings | null>(null);
  const [message, setMessage] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/staff/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        setValue((await response.json()) as Settings);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "Settings are unavailable until the approved migration is applied.",
          );
      });
    return () => controller.abort();
  }, [token]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!value) return;
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/staff/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new Error();
      setMessage("Operational settings saved and audited.");
    } catch {
      setMessage("Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-8 border-t border-subtle pt-6">
      <h2 className="text-2xl font-bold">Operational settings</h2>
      <p className="mt-2 text-sm text-muted">
        Pending owner values stay blank. Payment and booking remain unavailable
        until their later gates.
      </p>
      {value && (
        <form
          onSubmit={(event) => void save(event)}
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <label className="text-sm font-medium">
            Cleaning buffer (minutes)
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
              type="number"
              min="0"
              max="1440"
              value={value.cleaningBufferMinutes ?? ""}
              onChange={(event) =>
                setValue({
                  ...value,
                  cleaningBufferMinutes:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label className="text-sm font-medium">
            Checkout warning thresholds (comma-separated minutes)
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
              disabled={!("checkoutWarningMinutes" in value)}
              placeholder="Pending owner configuration / approved migration"
              defaultValue={value.checkoutWarningMinutes?.join(", ") ?? ""}
              onChange={(event) =>
                setValue({
                  ...value,
                  checkoutWarningMinutes: event.target.value.trim()
                    ? event.target.value.split(",").map((v) => Number(v.trim()))
                    : null,
                })
              }
            />
          </label>
          <label className="text-sm font-medium">
            Checkout alert (minutes)
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
              type="number"
              min="1"
              max="1440"
              value={value.checkoutAlertMinutes ?? ""}
              onChange={(event) =>
                setValue({
                  ...value,
                  checkoutAlertMinutes:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
          <label className="text-sm font-medium sm:col-span-2">
            Cancellation display text
            <textarea
              className="mt-1 min-h-24 w-full rounded-lg border border-subtle p-3"
              value={value.cancellationDisplayText ?? ""}
              onChange={(event) =>
                setValue({
                  ...value,
                  cancellationDisplayText: event.target.value || null,
                })
              }
            />
          </label>
          <button
            disabled={busy}
            className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white disabled:opacity-50"
          >
            Save settings
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-muted">
          {message}
        </p>
      )}
      <PaymentQrSettings token={token} />
    </section>
  );
}
