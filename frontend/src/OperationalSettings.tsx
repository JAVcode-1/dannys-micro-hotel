import React from "react";
import { useOutletContext } from "react-router";
import { apiBase } from "./staff-auth";
import PaymentQrSettings from "./PaymentQrSettings";
import { notifySuccess } from "./notifications";
import StaffIcon from "./StaffIcon";

type Settings = {
  cleaningBufferMinutes: number | null;
  checkoutAlertMinutes: number | null;
  checkoutWarningMinutes?: number[] | null;
  gcashQrObjectKey: string | null;
  gcashPayeeLabel: string | null;
  cancellationDisplayText: string | null;
};

export default function OperationalSettings({ token }: { token: string }) {
  const { signOut } = useOutletContext<{ signOut?: () => Promise<void> } | null>() ?? {};
  const [signingOut, setSigningOut] = React.useState(false);
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
      notifySuccess("Operational settings saved.");
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
        Leave unapproved values blank. Availability and payment safeguards still
        apply.
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
            Checkout reminders (minutes, separated by commas)
            <input
              className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
              disabled={!("checkoutWarningMinutes" in value)}
              placeholder="Not configured"
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
            Cancellation policy
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
      <section className="mt-8 rounded-xl border border-subtle bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold">Your session</h3>
            <p className="mt-1 text-sm text-muted">Sign out of your Staff/Admin account.</p>
          </div>
          <button
            type="button"
            disabled={signingOut || busy || !signOut}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-subtle px-4 text-primary disabled:opacity-50"
            onClick={async () => {
              if (signingOut || !signOut) return;
              setSigningOut(true);
              try {
                await signOut();
              } finally {
                setSigningOut(false);
              }
            }}
          >
            <StaffIcon name="logout" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </section>
    </section>
  );
}
