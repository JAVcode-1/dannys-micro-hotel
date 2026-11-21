import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { PaymentSession } from "@staytrack/shared";
import { hotelTime, peso } from "./BookingPlanner";
import { apiBase } from "./staff-auth";

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
  const expired = session.status === "expired" || remaining === 0;
  const confirmed = session.status === "confirmed";
  const canSubmit =
    !pending &&
    !expired &&
    session.status === "awaiting_proof" &&
    (preview || Boolean(session.qrUrl));
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (
      !file ||
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024 ||
      !reference.trim()
    ) {
      setMessage(
        "Choose a PNG or JPEG screenshot up to 5 MB and enter the transaction reference.",
      );
      return;
    }
    setBusy(true);
    try {
      await onSubmit(reference.trim(), file);
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
      className="mt-6 rounded-2xl border border-subtle bg-white p-6"
      aria-label="GCash payment proof"
    >
      <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
        {preview ? "O02 development preview" : "GCash payment proof"}
      </p>
      <h2 className="mt-3 text-2xl font-bold">
        {confirmed
          ? "Payment verified"
          : pending
            ? "Payment submitted — awaiting staff verification"
            : "Your payment details"}
      </h2>
      {preview && (
        <p className="mt-3 rounded-xl bg-lavender p-4 text-sm">
          Sample reservation only. Do not pay. Files selected here stay in this
          browser and are not uploaded.
        </p>
      )}
      <p className="mt-4 text-sm text-muted">Full reservation amount</p>
      <p className="text-3xl font-bold text-primary">
        {peso(session.amountDueCentavos)}
      </p>
      {confirmed ? (
        <p role="status" className="mt-5 rounded-xl bg-selected p-4">
          Staff verified receipt of your payment. See your reservation for each
          room's current status, schedule, refund details and available actions.
        </p>
      ) : session.status === "unavailable" ? (
        <p role="status" className="mt-5 rounded-xl bg-lavender p-4">
          Payment is unavailable for this reservation state. Contact staff for
          reconciliation before sending money.
        </p>
      ) : pending ? (
        <p role="status" className="mt-5 rounded-xl bg-selected p-4">
          Staff must check the actual GCash transaction. Your room capacity
          remains protected while review is pending. This submission does not
          confirm a booking.
        </p>
      ) : (
        <>
          <p className="mt-4">
            Proof deadline:{" "}
            <strong>{hotelTime(session.proofDeadlineAt)}</strong>
          </p>
          <p className="mt-2 text-sm text-muted">
            Time remaining: {Math.floor(remaining / 60000)}m{" "}
            {String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}s
          </p>
          {expired ? (
            <p role="status" className="mt-5 rounded-xl bg-lavender p-4">
              The proof deadline has passed. If you already paid, contact staff
              for reconciliation. Do not pay again. Availability must be checked
              again.
            </p>
          ) : (
            <>
              {remaining <= 25 * 60000 && (
                <p
                  role="status"
                  className="mt-4 text-sm font-semibold text-primary"
                >
                  Five-minute reminder: submit both your screenshot and
                  reference before the deadline.
                </p>
              )}
              {session.qrUrl && !preview ? (
                <figure className="mt-5">
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
                      maxLength={100}
                      value={reference}
                      onChange={(event) => setReference(event.target.value)}
                      className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-3 text-base"
                    />
                  </label>
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
                        ? "Preview proof submission"
                        : "Submit proof for staff verification"}
                  </button>
                </fieldset>
              </form>
            </>
          )}
          <p className="mt-5 text-sm text-muted">
            Email reminder schedule:{" "}
            {session.emailReminderAt.map(hotelTime).join(" and ")}. Email
            delivery is{" "}
            {session.emailDeliveryEnabled
              ? "enabled."
              : "not enabled in this environment."}
          </p>
        </>
      )}
      {message && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {message}
        </p>
      )}
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
          }}
        />
      )}
      <button
        className="mt-3 min-h-11 text-sm font-semibold text-primary"
        onClick={() => setRefresh((value) => value + 1)}
      >
        Refresh payment details
      </button>
    </div>
  );
}

export function PaymentPreview() {
  const [session] = useState<PaymentSession>(() => {
    const now = Date.now();
    return {
      reservationId: "preview",
      amountDueCentavos: 270000,
      serverNow: new Date(now).toISOString(),
      proofDeadlineAt: new Date(now + 30 * 60000).toISOString(),
      status: "awaiting_proof",
      payeeLabel: null,
      qrUrl: null,
      emailReminderAt: [15, 25].map((minute) =>
        new Date(now + minute * 60000).toISOString(),
      ),
      emailDeliveryEnabled: false,
    };
  });
  return (
    <main className="min-h-svh bg-canvas px-5 py-10 text-main">
      <div className="mx-auto max-w-2xl">
        <a href="/book" className="font-semibold text-primary">
          ← Back to stay planner
        </a>
        <PaymentPanel session={session} preview onSubmit={async () => {}} />
      </div>
    </main>
  );
}
