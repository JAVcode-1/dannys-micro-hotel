import { useApiQuery, writeApi } from "./api-query";
import React from "react";
import { useOutletContext } from "react-router";
import { apiBase } from "./staff-auth";
import PaymentQrSettings from "./PaymentQrSettings";
import { notifySuccess } from "./notifications";
import StaffIcon from "./StaffIcon";
import StaffLoadingSkeleton, {
  SkeletonBlock,
  SkeletonField,
} from "./StaffLoadingSkeleton";

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
  const settings = useApiQuery<Settings>("/staff/settings", token, {
    live: true,
  });
  const [draft, setValue] = React.useState<Settings>();
  const value = settings.data ? (draft ?? settings.data) : undefined;
  const [actionMessage, setMessage] = React.useState("");
  const message =
    actionMessage ||
    (settings.isError
      ? "Settings are unavailable until the approved migration is applied."
      : "");
  const [busy, setBusy] = React.useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!value) return;
    setMessage("");
    setBusy(true);
    try {
      const response = await writeApi(`${apiBase}/staff/settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(value),
      });
      if (!response.ok) throw new Error();
      await settings.refetch({ cancelRefetch: false });
      setValue(undefined);
      setMessage("Operational settings saved and audited.");
      notifySuccess("Operational settings saved.");
    } catch {
      setMessage("Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="staff-management space-y-4">
      <h2 className="text-2xl font-bold">Operational settings</h2>
      <div className="staff-settings-grid">
        {value && (
          <form
            onSubmit={(event) => void save(event)}
            className="staff-management-card staff-management-fields"
          >
            <h3 className="staff-management-wide text-lg font-semibold">
              Stay and booking settings
            </h3>
            <div>
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
            <div>
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
            <div className="staff-management-wide border-t border-subtle pt-4">
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
              className="staff-management-wide min-h-11 justify-self-start rounded-lg bg-primary px-5 font-semibold text-white disabled:opacity-50"
            >
              Save settings
            </button>
            {message && (
              <p role="status" className="staff-management-wide">
                {message}
              </p>
            )}
          </form>
        )}
        {!value &&
          (message ? (
            <p role="status" className="staff-management-card">
              {message}
            </p>
          ) : (
            <StaffLoadingSkeleton
              label="Loading operational settings…"
              className="staff-management-card"
            >
              <div className="space-y-4">
                <SkeletonBlock className="h-5 w-48" />
                <div className="staff-management-fields">
                  <SkeletonField />
                  <SkeletonField />
                </div>
                <div className="space-y-2 border-t border-subtle pt-4">
                  <SkeletonBlock className="h-3 w-44" />
                  <SkeletonBlock className="h-24 w-full" />
                </div>
                <SkeletonBlock className="h-11 w-36" />
              </div>
            </StaffLoadingSkeleton>
          ))}
        <PaymentQrSettings token={token} />
      </div>
      <section className="staff-management-card">
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
