import { useEffect, useId, useState } from "react";
import type { FormEvent } from "react";
import type { PaymentSession } from "@staytrack/shared";
import { hotelTime, peso } from "./BookingPlanner";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { readableLabel } from "./presentation";

const referencePattern = /^[0-9]{10,13}$/;

export function PaymentPanel({
  session,
  preview = false,
  onSubmit,
}: {
  session: PaymentSession;
  preview?: boolean;
  onSubmit(reference: string, file: File): Promise<void>;
}) {
  const [elapsed, setElapsed] = useState(0);
  const [reference, setReference] = useState("");
  const referenceHintId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState(session.status === "pending_review");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const started = performance.now();
    const timer = window.setInterval(
      () => setElapsed(performance.now() - started),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [session.serverNow]);
  const remaining = Math.max(
    0,
    Date.parse(session.proofDeadlineAt) -
      Date.parse(session.serverNow) -
      elapsed,
  );
  const expired =
    session.status === "expired" ||
    (session.status === "awaiting_proof" && remaining === 0);
  const confirmed = session.status === "confirmed";
  const received = session.receivedAmountCentavos;
  const canSubmit =
    !pending &&
    !expired &&
    session.status === "awaiting_proof" &&
    (preview || Boolean(session.qrUrl));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (!referencePattern.test(reference)) {
      setMessage("Enter a GCash transaction reference with 10 to 13 digits.");
      return;
    }
    if (
      !file ||
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage("Choose a PNG or JPEG payment screenshot up to 5 MB.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(reference, file);
      setPending(true);
      setFile(null);
      setReference("");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Proof could not be submitted. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="guest-payment mt-6 rounded-2xl border border-subtle bg-white"
      aria-label="GCash payment proof"
      data-payment-state={
        confirmed ? "confirmed" : pending ? "pending" : session.status
      }
    >
      <div className="guest-payment-intro">
        <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
          {preview ? "Payment preview" : "GCash payment"}
        </p>
        <h2 className="mt-3 text-2xl font-bold">
          {confirmed
            ? "Payment verified"
            : pending
              ? "Payment under review"
              : expired
                ? "Payment deadline passed"
                : session.status === "unavailable"
                  ? "Payment unavailable"
                  : "Pay with GCash"}
        </h2>
        {preview && (
          <p className="mt-3 rounded-xl bg-lavender p-4 text-sm">
            Sample reservation only. Do not pay. Files selected here stay in
            this browser and are not uploaded.
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          {confirmed
            ? "Amount verified"
            : pending
              ? "Amount due"
              : expired || session.status === "unavailable"
                ? "Reservation amount"
                : "Total amount to pay"}
        </p>
        <p className="text-3xl font-bold text-primary">
          {peso(
            confirmed
              ? (received ?? session.amountDueCentavos)
              : session.amountDueCentavos,
          )}
        </p>
        {!confirmed && received != null && (
          <p className="mt-3 rounded-xl bg-lavender p-4 text-sm">
            Staff recorded {peso(received)} received. Contact the hotel to
            resolve the difference before sending another payment.
          </p>
        )}
        {!confirmed &&
          !pending &&
          !expired &&
          session.status === "awaiting_proof" && (
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm">
              <li>
                <strong>Pay the full amount shown above.</strong> Scan the
                hotel’s QR code in GCash to send your payment.
              </li>
              <li>
                <strong>Submit your payment proof.</strong> Enter the GCash
                transaction reference, upload your payment screenshot, and
                select Submit proof before the deadline.
              </li>
              <li>
                <strong>Wait for staff verification.</strong> Your booking is
                confirmed only after staff verify your payment.
              </li>
            </ol>
          )}
        {!!session.allocations?.length && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-semibold">
              Payment breakdown
            </summary>
            <ul className="mt-2 divide-y divide-subtle">
              {session.allocations.map((allocation, index) => (
                <li key={index} className="flex justify-between gap-4 py-2">
                  <span>{readableLabel(allocation.label)}</span>
                  <strong>{peso(allocation.amountCentavos)}</strong>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
      <div className="guest-payment-process">
        {confirmed ? (
          <p role="status" className="mt-5 rounded-xl bg-selected p-4">
            Your GCash payment is verified. Your booking details show the
            current status of each room and event.
          </p>
        ) : session.status === "unavailable" ? (
          <p role="status" className="mt-5 rounded-xl bg-lavender p-4">
            Payment is unavailable for this reservation state. Contact staff for
            reconciliation before sending money.
          </p>
        ) : pending ? (
          <p role="status" className="mt-5 rounded-xl bg-selected p-4">
            Your proof was submitted. Your selected availability stays protected
            while staff checks the actual transaction. Your booking is not
            confirmed yet.
          </p>
        ) : (
          <>
            <p className="payment-deadline mt-4">
              Proof deadline:{" "}
              <strong>{hotelTime(session.proofDeadlineAt)}</strong>
            </p>
            <p className="mt-2 text-sm text-muted">
              Time remaining: {Math.floor(remaining / 60000)}m{" "}
              {String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}s
            </p>
            {!expired && (
              <p className="mt-2 text-sm text-muted">
                Submit both proof and reference before the deadline. Timely
                submission keeps your selected availability protected during
                review.
              </p>
            )}
            {expired ? (
              <p role="status" className="mt-5 rounded-xl bg-lavender p-4">
                The proof deadline has passed. If you already paid, contact
                staff for reconciliation. Do not pay again. Availability must be
                checked again.
              </p>
            ) : (
              <>
                {remaining <= 25 * 60000 && (
                  <p
                    role="status"
                    className="mt-4 text-sm font-semibold text-primary"
                  >
                    Reminder: submit your screenshot and reference before the
                    deadline.
                  </p>
                )}
                {session.qrUrl && !preview ? (
                  <figure className="guest-payment-qr mt-5">
                    <img
                      src={session.qrUrl}
                      alt="Staff-configured GCash payment QR"
                      className="max-h-72 max-w-full object-contain"
                    />
                    <figcaption className="mt-2 text-sm">
                      Payee: {session.payeeLabel}
                    </figcaption>
                  </figure>
                ) : (
                  <div
                    role="img"
                    aria-label="QR unavailable in preview"
                    className="mt-5 grid min-h-36 place-items-center rounded-xl border border-dashed border-subtle bg-canvas p-5 text-center text-sm text-muted"
                  >
                    {preview
                      ? "QR placeholder — no payment destination"
                      : "Payment QR is not configured. Do not send payment."}
                  </div>
                )}
                <p className="mt-3 text-sm text-muted">
                  QR access is short-lived. Refresh payment details if the image
                  expires.
                </p>
                <form
                  onSubmit={(event) => void submit(event)}
                  className="mt-5 space-y-4"
                >
                  <fieldset
                    disabled={!canSubmit || busy}
                    className="space-y-4 disabled:opacity-60"
                  >
                    <legend className="sr-only">Submit payment proof</legend>
                    <label className="block text-sm font-semibold">
                      Transaction reference
                      <input
                        required
                        inputMode="numeric"
                        pattern={referencePattern.source}
                        aria-describedby={referenceHintId}
                        value={reference}
                        onChange={(event) => setReference(event.target.value)}
                        className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-3 text-base"
                      />
                    </label>
                    <p id={referenceHintId} className="text-sm text-muted">
                      Enter 10 to 13 digits.
                    </p>
                    <label className="block text-sm font-semibold">
                      Payment screenshot (PNG/JPEG, up to 5 MB)
                      <input
                        type="file"
                        required
                        accept="image/png,image/jpeg"
                        onChange={(event) =>
                          setFile(event.target.files?.[0] ?? null)
                        }
                        className="mt-2 block min-h-11 w-full text-base"
                      />
                    </label>
                    <button className="min-h-11 rounded-xl bg-booking px-5 font-bold text-main">
                      {busy
                        ? "Submitting…"
                        : preview
                          ? "Preview upload"
                          : "Submit proof"}
                    </button>
                  </fieldset>
                </form>
              </>
            )}
            <details className="mt-5 text-sm text-muted">
              <summary className="cursor-pointer font-semibold">
                Payment reminders
              </summary>
              <p className="mt-2">
                Email reminder schedule:{" "}
                {session.emailReminderAt.map(hotelTime).join(" and ")}. Email
                delivery is{" "}
                {session.emailDeliveryEnabled
                  ? "enabled."
                  : "not enabled in this environment."}
              </p>
            </details>
          </>
        )}
        {message && (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}

export default function GuestPayment({
  reservationId,
  token,
}: {
  reservationId: string;
  token: string;
}) {
  const [session, setSession] = useState<PaymentSession | null>(null);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setSession(null);
    setMessage("");
    const controller = new AbortController();
    void fetch(`${apiBase}/guest/payments/${reservationId}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as PaymentSession & {
          error?: string;
        };
        if (!response.ok)
          throw new Error(data.error || "Payment details unavailable.");
        if (!controller.signal.aborted) setSession(data);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error
              ? error.message
              : "Payment details unavailable.",
          );
      });
    return () => controller.abort();
  }, [reservationId, token, refresh]);
  return (
    <div>
      {message && (
        <p role="status" className="mt-4 text-sm text-muted">
          {message}
        </p>
      )}
      {session && (
        <PaymentPanel
          key={session.serverNow}
          session={session}
          onSubmit={async (reference, file) => {
            const response = await fetch(
              `${apiBase}/guest/payments/${reservationId}/proof`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${token}`,
                  "Content-Type": file.type,
                  "X-Transaction-Reference": encodeURIComponent(reference),
                },
                body: file,
              },
            );
            if (!response.ok) {
              const data = (await response.json()) as { error?: string };
              throw new Error(data.error || "Proof submission unavailable.");
            }
            notifySuccess(
              "Payment proof submitted. Awaiting staff verification.",
            );
          }}
        />
      )}
      <button
        className="mt-3 min-h-11 text-sm font-semibold text-primary"
        onClick={() => setRefresh((value) => value + 1)}
      >
        Refresh payment
      </button>
    </div>
  );
}
