import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type {
  PaymentDecision,
  PaymentReviewInput,
  StaffPaymentReview,
} from "@staytrack/shared";
import { apiBase } from "./staff-auth";

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
  review: StaffPaymentReview;
  confirmationEnabled?: boolean;
  preview?: boolean;
  onDecision: (value: PaymentReviewInput) => Promise<void>;
  onProof: () => Promise<{ url: string; expiresIn: number }>;
}) {
  const [decision, setDecision] = useState<PaymentDecision>("unresolved");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("12");
  const [minute, setMinute] = useState("00");
  const [period, setPeriod] = useState("AM");
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
    if (choice === "confirmed") {
      if (
        !date ||
        !/^\d+(?:\.\d{1,2})?$/.test(amount) ||
        !reference.trim() ||
        !recipient.trim()
      ) {
        setMessage(
          "Complete the actual ledger reference, recipient, amount and received time.",
        );
        return;
      }
      const [y, m, d] = date.split("-").map(Number);
      verification = {
        ledgerChecked: true,
        receivingAccountChecked: true,
        timeChecked: true,
        reference,
        recipient,
        amountCentavos: Math.round(Number(amount) * 100),
        receivedAt: new Date(
          Date.UTC(
            y,
            m - 1,
            d,
            (Number(hour) % 12) + (period === "PM" ? 12 : 0) - 8,
            Number(minute),
          ),
        ).toISOString(),
      };
    }
    const body = JSON.stringify({
      decision: choice,
      expectedVersion: review.version,
      note,
      verification,
    });
    if (attempt.current?.body !== body)
      attempt.current = { body, key: crypto.randomUUID() };
    setBusy(true);
    try {
      await onDecision({
        ...JSON.parse(body),
        requestKey: attempt.current!.key,
      });
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
    <article className="min-w-0 rounded-xl border border-subtle bg-white p-5 sm:p-7">
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
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">Full booked amount</dt>
          <dd className="text-2xl font-bold">
            {money(review.amountDueCentavos)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Submitted reference</dt>
          <dd className="break-all font-semibold">
            {review.transactionReference}
          </dd>
        </div>
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
        <div className="mt-4 rounded-lg border border-subtle p-3 text-sm">
          <p className="font-semibold">
            Last review · {time(review.lastReview.createdAt)}
          </p>
          <p className="whitespace-pre-wrap break-words">
            {review.lastReview.note}
          </p>
          <p className="mt-1 break-all text-xs text-muted">
            Staff actor: {review.lastReview.actorId}
          </p>
        </div>
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
      <button
        type="button"
        disabled={busy || preview}
        onClick={() => {
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
        View private proof
      </button>
      {proof && (
        <img
          src={proof.url}
          referrerPolicy="no-referrer"
          alt="Submitted payment proof for staff inspection; verify actual receipt separately"
          className="mt-4 max-h-96 max-w-full rounded-lg border border-subtle object-contain"
        />
      )}
      <p className="mt-4 rounded-lg bg-lavender p-3 text-sm">
        A screenshot does not establish receipt. Check the hotel’s actual
        receiving GCash account. Unresolved, rejected or mismatched proofs stay
        protected for manual reconciliation. Never send an automatic refund or
        change a schedule without guest consent.
      </p>
      {!confirmationEnabled && (
        <p className="mt-3 text-sm font-semibold text-primary">
          Live confirmation is disabled pending hosted acceptance and security
          checks.
        </p>
      )}
      {review.status !== "confirmed" && (
        <form
          onSubmit={(event) => void submit(event)}
          className="mt-5 space-y-4"
        >
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
          {decision === "confirmed" && (
            <fieldset className="space-y-3 rounded-lg border border-subtle p-4">
              <legend className="px-1 font-semibold">
                Actual receiving-account record
              </legend>
              {[
                "I checked actual receipt in the hotel’s GCash ledger.",
                "I matched the hotel receiving account and full amount.",
                "I matched transaction time and the unused reference.",
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
              <label className="block text-sm">
                Ledger reference
                <input
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  maxLength={100}
                  className="mt-1 w-full rounded-lg border border-subtle p-3"
                />
              </label>
              <label className="block text-sm">
                Receiving payee label
                <input
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-subtle p-3"
                />
              </label>
              <label className="block text-sm">
                Received amount (PHP)
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-subtle p-3"
                />
              </label>
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
                <label>
                  Hour
                  <select
                    aria-label="Received hour"
                    value={hour}
                    onChange={(event) => setHour(event.target.value)}
                    className="m-1 rounded-lg border border-subtle p-2"
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                      (value) => (
                        <option key={value}>{value}</option>
                      ),
                    )}
                  </select>
                </label>
                <label>
                  Minute
                  <select
                    aria-label="Received minute"
                    value={minute}
                    onChange={(event) => setMinute(event.target.value)}
                    className="m-1 rounded-lg border border-subtle p-2"
                  >
                    {Array.from({ length: 60 }, (_, i) =>
                      String(i).padStart(2, "0"),
                    ).map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
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
  const [reviews, setReviews] = useState<StaffPaymentReview[]>([]);
  const [selected, setSelected] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("Loading review queue…");
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setMessage("Loading review queue…");
    setReviews([]);
    setEnabled(false);
    void fetch(`${apiBase}/staff/payment-reviews?page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Review queue is unavailable. Staff authorization and the approved O03 migration are required.",
          );
        const data = (await response.json()) as {
          reviews: StaffPaymentReview[];
          confirmationEnabled: boolean;
          hasMore: boolean;
        };
        if (controller.signal.aborted) return;
        setReviews(data.reviews);
        setEnabled(data.confirmationEnabled);
        setHasMore(data.hasMore);
        setMessage(
          data.reviews.length ? "" : "No submitted proofs await review.",
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setReviews([]);
          setEnabled(false);
          setMessage(
            error instanceof Error
              ? error.message
              : "Review queue unavailable.",
          );
        }
      });
    return () => controller.abort();
  }, [token, revision, page]);
  const current = reviews.find((row) => row.id === selected) ?? reviews[0];
  async function request(path: string, body?: PaymentReviewInput) {
    const response = await fetch(
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
    <section className="mt-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Payment review</h1>
        <button
          type="button"
          onClick={() => setRevision((value) => value + 1)}
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
        className="mb-4 flex items-center gap-4 text-sm"
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
      {current && (
        <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
          <nav aria-label="Payment review queue" className="space-y-2">
            {reviews.map((row) => (
              <button
                key={row.id}
                onClick={() => setSelected(row.id)}
                className={`w-full rounded-lg border border-subtle p-3 text-left ${row.id === current.id ? "bg-selected" : "bg-white"}`}
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
              setRevision((value) => value + 1);
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
