import { useApiQuery, writeApi } from "./api-query";
import TimePartInput, { manilaClock } from "./TimePartInput";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  PaymentDecision,
  PaymentReviewInput,
  StaffPaymentReview,
} from "@staytrack/shared";
import { parsePesoInput } from "./peso-input";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import StaffIcon from "./StaffIcon";
import StaffLoadingSkeleton, { SkeletonBlock } from "./StaffLoadingSkeleton";

const money = (value: number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    value / 100,
  );
const time = (value: string) =>
  new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(value));
const labels = {
  on_time: "Within review target",
  overdue: "Overdue · 15m+",
  urgent: "Urgent · 30m+",
  critical: "Critical · 60m+",
};
const decisions: Record<PaymentDecision, string> = {
  confirmed: "Confirmed",
  rejected: "Rejected proof",
  mismatched: "Payment mismatch",
  unresolved: "Unresolved — contact guest",
  late_reconciliation: "Late payment reconciliation",
};

export function PaymentReviewPanel({
  review,
  confirmationEnabled = false,
  preview = false,
  onDecision,
  onProof,
}: {
  review: StaffPaymentReview & {
    hallItems?: {
      id: string;
      setup: string;
      startAt: string;
      endAt: string;
      attendees: number;
      totalCentavos: number;
    }[];
  };
  confirmationEnabled?: boolean;
  preview?: boolean;
  onDecision: (value: PaymentReviewInput) => Promise<void>;
  onProof: () => Promise<{ url: string; expiresIn: number }>;
}) {
  const [decision, setDecision] = useState<PaymentDecision>("unresolved");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [ledgerReference, setLedgerReference] = useState("");
  const reference = review.transactionReference ?? ledgerReference.trim();
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("AM");
  const [correctingTime, setCorrectingTime] = useState(false);
  const [syncedTime, setSyncedTime] = useState<string | null>(null);
  const [checks, setChecks] = useState([false, false, false]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [proof, setProof] = useState<{ url: string; expiresAt: number } | null>(
    null,
  );
  const attempt = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    if (!proof) return;
    const timer = setTimeout(
      () => setProof(null),
      Math.max(0, proof.expiresAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [proof]);
  const receivedClock = manilaClock(hour, minute, period);
  function syncReceivedTime() {
    const previousTime = Date.parse(
      syncedTime ?? `${date}T${receivedClock}:00+08:00`,
    );
    const bookingTime = Date.parse(review.submittedAt);
    const manila = new Date(bookingTime + 8 * 60 * 60 * 1000);
    const syncedHour = manila.getUTCHours();
    setSyncedTime(review.submittedAt);
    setCorrectingTime(false);
    setDate(manila.toISOString().slice(0, 10));
    setHour(String(syncedHour % 12 || 12));
    setMinute(String(manila.getUTCMinutes()).padStart(2, "0"));
    setPeriod(syncedHour >= 12 ? "PM" : "AM");
    if (Number.isFinite(previousTime) && previousTime !== bookingTime)
      setChecks(([ledger, account]) => [ledger, account, false]);
  }
  async function submit(event: FormEvent, choice = decision) {
    event.preventDefault();
    if (busy) return;
    setMessage("");
    if (!note.trim()) {
      setMessage("Enter a review note and next action for the guest.");
      return;
    }
    if (
      choice === "confirmed" &&
      (!confirmationEnabled || !checks.every(Boolean))
    ) {
      setMessage(
        "Confirmation requires all actual receiving-account checks and an open acceptance gate.",
      );
      return;
    }
    let verification: PaymentReviewInput["verification"];
    let receivedCentavos: number | undefined;
    if (choice === "confirmed" || (choice === "mismatched" && amount.trim())) {
      try {
        receivedCentavos = parsePesoInput(amount);
      } catch (error) {
        setMessage((error as Error).message);
        return;
      }
    }
    if (choice === "confirmed") {
      const receivedMs = Date.parse(`${date}T${receivedClock}:00+08:00`);
      if (!reference) {
        setMessage("Enter the reference from the hotel’s GCash ledger.");
        return;
      }
      if (
        !Number.isFinite(receivedMs) ||
        !receivedCentavos ||
        !review.payeeLabel
      ) {
        setMessage(
          "Enter the received amount and verify the configured payee and received time.",
        );
        return;
      }
      verification = {
        ledgerChecked: true,
        receivingAccountChecked: true,
        timeChecked: true,
        reference,
        recipient: review.payeeLabel,
        amountCentavos: receivedCentavos,
        receivedAt: syncedTime ?? new Date(receivedMs).toISOString(),
      };
    }
    const body = JSON.stringify({
      decision: choice,
      expectedVersion: review.version,
      note,
      verification,
      ...(choice === "mismatched" && {
        receivedAmountCentavos: receivedCentavos,
      }),
    });
    if (attempt.current?.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await onDecision({
        ...JSON.parse(body),
        requestKey: attempt.current!.key,
      });
      if (!preview) notifySuccess("Payment review decision recorded.");
      setMessage(
        preview
          ? "Preview decision saved locally. No payment or booking was changed."
          : "Decision recorded. Notification is queued; email delivery is not enabled.",
      );
      attempt.current = null;
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Decision unavailable. Retry without changing the form, or refresh to reconcile.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="staff-payment-panel min-w-0 rounded-xl border border-subtle bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Manual GCash review
          </p>
          <h2 className="mt-2 break-words text-xl font-bold">
            {review.primaryName}
          </h2>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${review.age === "critical" ? "bg-red-50 text-red-800" : "bg-selected text-primary"}`}
        >
          {labels[review.age]}
        </span>
      </div>
      <dl className="staff-payment-summary mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Total amount</dt>
          <dd className="text-2xl font-bold">
            {money(review.amountDueCentavos)}
          </dd>
        </div>
        {review.transactionReference && (
          <div>
            <dt className="text-sm text-muted">Submitted reference</dt>
            <dd className="break-all font-semibold">
              {review.transactionReference}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-muted">Proof submitted · Manila</dt>
          <dd>{time(review.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Review status</dt>
          <dd>
            {review.status === "pending_review"
              ? "Awaiting staff verification"
              : decisions[review.status]}
          </dd>
        </div>
      </dl>
      {review.duplicateReference && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-800">
          Reference already verified on another reservation. Reconcile with the
          guest; do not confirm again.
        </p>
      )}
      {review.lastReview && (
        <details className="mt-4 rounded-lg border border-subtle p-3 text-sm">
          <summary className="min-h-11 cursor-pointer font-semibold">
            Review history
          </summary>
          <p className="font-semibold">
            Last review · {time(review.lastReview.createdAt)}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {review.lastReview.note}
          </p>
          <p className="mt-1 break-all text-xs text-muted">
            Staff ID: {review.lastReview.actorId}
          </p>
        </details>
      )}
      <ul className="mt-5 divide-y divide-subtle border-y border-subtle">
        {review.items.map((item, index) => (
          <li key={index} className="py-3 text-sm">
            <strong>
              {item.category === "family_executive"
                ? "Family Executive"
                : "Double Standard"}
            </strong>
            <p>
              {time(item.startAt)} → {time(item.endAt)}
            </p>
            <p className="text-muted">
              Booked item: {money(item.totalCentavos)}
            </p>
          </li>
        ))}
      </ul>
      {!!review.hallItems?.length && (
        <div className="mt-4 rounded-lg bg-selected p-4">
          <h3 className="font-semibold">
            {review.items.length
              ? "Accommodation + Function Hall"
              : "Function Hall"}
          </h3>
          <p className="mt-1 text-sm">
            One GCash transaction covers every item. Confirm only after
            verifying the full reservation amount.
          </p>
          {review.hallItems.map((item) => (
            <div key={item.id} className="mt-3 text-sm">
              <strong>
                Function Hall ·{" "}
                {item.setup === "theater" ? "Theater Type" : "Room Type"}
              </strong>
              <p>
                {time(item.startAt)} → {time(item.endAt)}
              </p>
              <p>
                {item.attendees} attendees · Allocated amount{" "}
                {money(item.totalCentavos)}
              </p>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={busy || preview}
        aria-expanded={Boolean(proof)}
        onClick={() => {
          if (proof) {
            setProof(null);
            return;
          }
          setBusy(true);
          void onProof()
            .then((result) =>
              setProof({
                url: result.url,
                expiresAt: Date.now() + result.expiresIn * 1000,
              }),
            )
            .catch(() =>
              setMessage(
                "Private proof is unavailable. Refresh and try again.",
              ),
            )
            .finally(() => setBusy(false));
        }}
        className="mt-4 rounded-lg border border-subtle px-4 py-2 font-semibold text-primary disabled:opacity-50"
      >
        {proof ? "Hide private proof" : "View private proof"}
      </button>
      {proof && (
        <img
          src={proof.url}
          referrerPolicy="no-referrer"
          alt="Submitted payment proof for staff inspection; verify actual receipt separately"
          className="mt-4 max-h-96 max-w-full rounded-lg border border-subtle object-contain"
        />
      )}
      {review.status !== "confirmed" && (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-5 space-y-4"
        >
          <p className="staff-payment-verification-note rounded-lg bg-lavender p-3 text-sm">
            <StaffIcon name="payments" />
            Verify the full payment in the hotel’s GCash account before
            confirming.
          </p>
          {!confirmationEnabled && (
            <p className="text-sm font-semibold text-primary">
              Payment confirmation is currently unavailable.
            </p>
          )}
          <label className="block text-sm font-semibold">
            Review decision
            <select
              value={decision}
              onChange={(event) =>
                setDecision(event.target.value as PaymentDecision)
              }
              className="mt-1 w-full rounded-lg border border-subtle bg-white p-3"
            >
              {Object.entries(decisions).map(([key, label]) => (
                <option
                  key={key}
                  value={key}
                  disabled={key === "confirmed" && !confirmationEnabled}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          {(decision === "confirmed" || decision === "mismatched") && (
            <fieldset className="space-y-3 rounded-lg border border-subtle p-4">
              <legend className="px-1 font-semibold">
                Actual receiving-account record
              </legend>
              {decision === "confirmed" && !review.transactionReference && (
                <label className="block text-sm">
                  GCash ledger reference
                  <input
                    value={ledgerReference}
                    maxLength={100}
                    onChange={(event) => {
                      setLedgerReference(event.target.value);
                      setChecks(([ledger, account]) => [
                        ledger,
                        account,
                        false,
                      ]);
                    }}
                    className="mt-1 w-full rounded-lg border border-subtle p-3"
                  />
                </label>
              )}
              {decision === "confirmed" &&
                [
                  "I checked actual receipt in the hotel’s GCash ledger.",
                  "I matched the hotel receiving account and full amount.",
                  review.transactionReference
                    ? "I matched the transaction time and submitted reference against GCash."
                    : "I checked the transaction time and reference in the hotel’s GCash ledger.",
                ].map((label, index) => (
                  <label key={label} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checks[index]}
                      onChange={(event) =>
                        setChecks(
                          checks.map((value, i) =>
                            i === index ? event.target.checked : value,
                          ),
                        )
                      }
                    />
                    {label}
                  </label>
                ))}
              <div className="text-sm">
                <span className="block">Receiving payee label</span>
                <p className="mt-1 font-semibold">
                  {review.payeeLabel ||
                    "Set the verified GCash account name in Settings."}
                </p>
              </div>
              <label className="block text-sm">
                Received amount (PHP)
                {decision === "mismatched" && " · optional"}
                <input
                  inputMode="decimal"
                  placeholder="₱1,000.00"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-subtle p-3"
                />
              </label>
              {decision === "confirmed" && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={syncReceivedTime}
                      className="min-h-11 rounded-lg border border-subtle px-3 text-sm font-semibold text-primary"
                    >
                      Use booking received time
                    </button>
                    <button
                      type="button"
                      aria-expanded={correctingTime}
                      onClick={() => setCorrectingTime((value) => !value)}
                      className="min-h-11 rounded-lg border border-subtle px-3 text-sm font-semibold text-primary"
                    >
                      {correctingTime
                        ? "Hide time fields"
                        : "Correct transaction time"}
                    </button>
                  </div>
                  <p className="text-sm" role="status">
                    {date
                      ? `Received time (Manila): ${date}, ${hour}:${minute} ${period}`
                      : "Use the proof submission time if it matches GCash, or enter the actual transaction time."}
                  </p>
                  {correctingTime && (
                    <div
                      className="space-y-2"
                      onChange={() => {
                        setSyncedTime(null);
                        setChecks([checks[0], checks[1], false]);
                      }}
                    >
                      <label className="block text-sm">
                        Received date (Manila)
                        <input
                          type="date"
                          value={date}
                          onChange={(event) => setDate(event.target.value)}
                          className="mt-1 block rounded-lg border border-subtle p-3"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <div>
                          Hour
                          <TimePartInput
                            part="hour"
                            label="Received hour"
                            value={hour}
                            onChange={setHour}
                            className="mt-1 min-h-11 rounded-lg border border-subtle p-2"
                          />
                        </div>
                        <div>
                          Minute
                          <TimePartInput
                            part="minute"
                            label="Received minute"
                            value={minute}
                            onChange={setMinute}
                            className="mt-1 min-h-11 rounded-lg border border-subtle p-2"
                          />
                        </div>
                        <select
                          aria-label="Received AM or PM"
                          value={period}
                          onChange={(event) => setPeriod(event.target.value)}
                          className="rounded-lg border border-subtle p-2"
                        >
                          <option>AM</option>
                          <option>PM</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
          )}
          <label className="block text-sm font-semibold">
            Review note and guest recovery action
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-subtle p-3"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              disabled={busy || decision === "confirmed"}
              className="rounded-lg border border-primary px-4 py-3 font-semibold text-primary disabled:opacity-50"
            >
              {preview
                ? "Preview reconciliation decision"
                : "Record reconciliation decision"}
            </button>
            <button
              type="button"
              disabled={
                busy ||
                !confirmationEnabled ||
                decision !== "confirmed" ||
                !checks.every(Boolean) ||
                !reference ||
                !review.payeeLabel ||
                !date ||
                !receivedClock ||
                review.duplicateReference
              }
              onClick={(event) => void submit(event, "confirmed")}
              className="rounded-lg bg-primary px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              Confirm verified payment
            </button>
          </div>
        </form>
      )}
      {message && (
        <p role="status" className="mt-4 rounded-lg bg-selected p-3 text-sm">
          {message}
        </p>
      )}
    </article>
  );
}

export default function StaffPaymentReviews({ token }: { token: string }) {
  const [selected, setSelected] = useState("");
  const [page, setPage] = useState(0);
  const queue = useApiQuery<{
    reviews: StaffPaymentReview[];
    confirmationEnabled: boolean;
    hasMore: boolean;
  }>("/staff/payment-reviews?page=" + page, token, { live: true });
  const reviews = queue.data?.reviews ?? [];
  const enabled = queue.data?.confirmationEnabled === true && !queue.isError;
  const hasMore = queue.data?.hasMore ?? false;
  const message = queue.isError
    ? "Review queue is unavailable. Staff authorization and the approved O03 migration are required."
    : queue.isPending
      ? "Loading payment reviews…"
      : !reviews.length
        ? "No submitted proofs await review."
        : "";
  const current = reviews.find((row) => row.id === selected) ?? reviews[0];
  async function request(path: string, body?: PaymentReviewInput) {
    const response = await writeApi(
      `${apiBase}/staff/payment-reviews/${current.id}/${path}`,
      {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        data.error ?? "Review unavailable. Refresh to reconcile.",
      );
    return data;
  }
  return (
    <section className="staff-payment-reviews mt-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Payment review</h1>
        <button
          type="button"
          onClick={() => void queue.refetch({ cancelRefetch: false })}
          className="rounded-lg border border-subtle px-4 py-2 text-primary"
        >
          Refresh queue
        </button>
      </div>
      {message && (
        <p role="status" className="mb-4 text-muted">
          {message}
        </p>
      )}
      <nav
        aria-label="Review queue pages"
        className="staff-worklist-toolbar mb-4 flex flex-wrap items-center gap-4 text-sm"
      >
        <button
          type="button"
          disabled={page === 0}
          onClick={() => setPage((value) => value - 1)}
          className="rounded-lg border border-subtle px-3 py-2 text-primary disabled:opacity-50"
        >
          Previous page
        </button>
        <span>Page {page + 1}</span>
        <button
          type="button"
          disabled={!hasMore}
          onClick={() => setPage((value) => value + 1)}
          className="rounded-lg border border-subtle px-3 py-2 text-primary disabled:opacity-50"
        >
          Next page
        </button>
      </nav>
      {message === null && (
        <StaffLoadingSkeleton label="Loading review queue…">
          <div className="staff-payment-layout grid gap-5">
            <div className="staff-payment-queue space-y-2">
              {["w-24", "w-32", "w-28"].map((nameWidth) => (
                <div
                  key={nameWidth}
                  className="space-y-2 rounded-lg border border-subtle bg-white/80 p-3"
                >
                  <SkeletonBlock className={`h-4 ${nameWidth}`} />
                  <SkeletonBlock className="h-3 w-20" />
                </div>
              ))}
            </div>
            <div className="staff-payment-panel min-w-0 space-y-4 rounded-xl border border-subtle bg-white p-5 sm:p-7">
              <SkeletonBlock className="h-5 w-40" />
              <SkeletonBlock className="h-4 w-56" />
              <div className="staff-payment-summary grid gap-4 sm:grid-cols-2">
                {["w-20", "w-24", "w-16", "w-28"].map((labelWidth) => (
                  <div
                    key={labelWidth}
                    className="space-y-2 rounded-lg border border-subtle p-3"
                  >
                    <SkeletonBlock className={`h-3 ${labelWidth}`} />
                    <SkeletonBlock className="h-5 w-20" />
                  </div>
                ))}
              </div>
              <div className="space-y-3 border-t border-subtle pt-4">
                <SkeletonBlock className="h-4 w-36" />
                <SkeletonBlock className="h-11 w-44" />
              </div>
            </div>
          </div>
        </StaffLoadingSkeleton>
      )}
      {current && (
        <div className="staff-payment-layout grid gap-5">
          <nav
            aria-label="Payment review queue"
            className="staff-payment-queue space-y-2"
          >
            {reviews.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setSelected(row.id)}
                aria-pressed={row.id === current.id}
                className="w-full rounded-lg border border-subtle p-3 text-left"
              >
                <strong className="block break-words">{row.primaryName}</strong>
                <span className="block text-sm">
                  {money(row.amountDueCentavos)} · {labels[row.age]}
                </span>
                <span className="text-xs text-muted">
                  {row.status === "pending_review"
                    ? "Awaiting verification"
                    : decisions[row.status]}
                </span>
              </button>
            ))}
          </nav>
          <PaymentReviewPanel
            key={`${current.id}:${current.version}`}
            review={current}
            confirmationEnabled={enabled}
            onProof={() => request("proof")}
            onDecision={async (body) => {
              await request("decision", body);
              void queue.refetch({ cancelRefetch: false });
            }}
          />
        </div>
      )}
    </section>
  );
}

export function PaymentReviewPreview() {
  const [review, setReview] = useState<StaffPaymentReview>({
    id: "synthetic-o03",
    reservationId: "synthetic-reservation",
    primaryName: "Sample guest — test only",
    transactionReference: "SYNTHETIC-REF-001",
    amountDueCentavos: 270000,
    submittedAt: "2026-11-19T05:00:00Z",
    status: "pending_review",
    version: 0,
    age: "urgent",
    duplicateReference: false,
    items: [
      {
        category: "double_standard",
        startAt: "2026-12-01T06:00:00Z",
        endAt: "2026-12-01T09:00:00Z",
        totalCentavos: 20000,
      },
      {
        category: "family_executive",
        startAt: "2026-12-02T08:00:00Z",
        endAt: "2026-12-04T08:00:00Z",
        totalCentavos: 250000,
      },
    ],
  });
  return (
    <main className="min-h-svh bg-canvas px-4 py-8 text-main sm:px-8">
      <div className="mx-auto max-w-4xl">
        <a href="/staff" className="font-semibold text-primary">
          StayTrack · Danny’s Micro Hotel
        </a>
        <h1 className="mt-6 text-3xl font-bold">Payment review</h1>
        <p className="mb-6 mt-3 rounded-lg bg-selected p-4 text-primary">
          Synthetic preview · No actual QR, proof, guest, payment or network
          decision. Confirmation is disabled.
        </p>
        <PaymentReviewPanel
          review={review}
          preview
          onProof={async () => {
            throw new Error("No synthetic proof upload");
          }}
          onDecision={async (value) =>
            setReview({
              ...review,
              status: value.decision,
              version: review.version + 1,
            })
          }
        />
      </div>
    </main>
  );
}
