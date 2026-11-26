import React from "react";
import { useOutletContext } from "react-router";
import { apiBase } from "./staff-auth";
import PaymentQrSettings from "./PaymentQrSettings";
import { notifySuccess } from "./notifications";
import StaffIcon from "./StaffIcon";

type Settings = {
  cleaningBufferMinutes: number | null;
  checkoutAlertMinutes: number | null;
  gcashQrObjectKey: string | null;
  gcashPayeeLabel: string | null;
  cancellationDisplayText: string | null;
};

export default function OperationalSettings({ token }: { token: string }) {
  const { signOut } =
    useOutletContext<{ signOut?: () => Promise<void> } | null>() ?? {};
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
    setMessage("");
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
      {value && (
        <form
          onSubmit={(event) => void save(event)}
          className="mt-6 grid gap-4 sm:grid-cols-2"
        >
          <div className="sm:col-span-2">
            <label
              className="text-sm font-medium"
              htmlFor="settings-cleaning-buffer"
            >
              Cleaning buffer (minutes after checkout)
            </label>
            <input
              id="settings-cleaning-buffer"
              className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
              type="number"
              min="0"
              max="1440"
              disabled={busy}
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
          </div>
          <div className="sm:col-span-2">
            <label
              className="text-sm font-medium"
              htmlFor="settings-checkout-alert"
            >
              Checkout reminder (minutes before checkout)
            </label>
            <input
              id="settings-checkout-alert"
              className="mt-1 min-h-11 w-full rounded-lg border border-subtle px-3"
              type="number"
              min="1"
              max="1440"
              disabled={busy}
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
          </div>
          <div className="border-t border-subtle pt-4 sm:col-span-2">
            <label
              className="text-sm font-medium"
              htmlFor="settings-cancellation-policy"
            >
              Online cancellation policy wording
            </label>
            <textarea
              id="settings-cancellation-policy"
              aria-describedby="settings-cancellation-help"
              className="mt-1 min-h-24 w-full rounded-lg border border-subtle p-3"
              disabled={busy}
              maxLength={2000}
              value={value.cancellationDisplayText ?? ""}
              onChange={(event) =>
                setValue({
                  ...value,
                  cancellationDisplayText: event.target.value || null,
                })
              }
            />
            <p
              id="settings-cancellation-help"
              className="mt-2 text-sm text-muted"
            >
              Applies to newly confirmed online reservations.
            </p>
          </div>
          <button
            disabled={busy}
            className="min-h-11 rounded-lg bg-primary px-5 font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-end"
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
          <h3 className="font-semibold">Your session</h3>
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
