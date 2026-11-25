import { readableLabel } from "./presentation";
import { useEffect, useEffectEvent, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FormEvent } from "react";
import ManilaDateTimeInput from "./ManilaDateTimeInput";
import PublicHallStatus from "./PublicHallStatus";
import { StaffRefundIssue } from "./RefundIssue";
import TimePartInput from "./TimePartInput";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import {
  pendingHallCommand,
  hallCentavos,
  type PendingHallCommand,
} from "./hall-command-state";

const pesos = (c: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(c) / 100,
  );
const hotel = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});
type Row = {
  changeRequests?: {
    id: string;
    kind: string;
    reason: string;
    input: {
      start?: string;
      setup?: string;
      attendees?: number;
      minutes?: number;
      hours?: number;
    };
    recorded_at: string;
  }[];
  unifiedReservationId?: string | null;
  onlineState?: string | null;
  inquiryPrice?: number;
  depositDue?: number;
  startPaymentIssue?: string;
  released_at?: string | null;
  claim_id: string | null;
  preparation_conflict: boolean;
  id: string;
  organizer: string;
  channel: string;
  status: string;
  ready: boolean;
  payment_resolution: boolean;
  total: string;
  overtime: string;
  collected: string;
  refunded: string;
  refundDue?: string;
  balance: string;
  actual_end: string | null;
  requests: string | null;
  quote_input: { start: string };
  quote: { start: string; end: string } | null;
};
type Finances = {
  id: string;
  receipts: {
    id: string;
    method: string;
    amount: string;
    reference: string | null;
    received_at: string;
    evidence: string;
  }[];
  refunds: {
    id: string;
    amount: string;
    transferredAmount: string;
    remainingAmount: string;
    reason: string;
    pending: boolean;
    transfers: {
      id: string;
      amount: string;
      method: string;
      reference: string | null;
      transferred_at: string;
    }[];
  }[];
};

export function HallInformation() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 rounded-2xl border border-subtle bg-white p-6 sm:p-9">
      <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
        Meetings &amp; events
      </p>
      <h1 className="text-3xl font-bold">Your event, your way.</h1>
      <p>
        One exclusive Function Hall, with Theater Type for up to 70 attendees or
        Room Type for up to 50. These are alternative setups of the same hall.
      </p>
      <PublicHallStatus />
      <div className="rounded-xl bg-selected p-5 text-sm leading-7">
        <p>
          <strong>Three-hour package: ₱3,000.00</strong> for starts from 8:00 AM
          to before 5:00 PM.
        </p>
        <p>
          <strong>Three-hour package: ₱5,000.00</strong> for starts from 5:00 PM
          until before 8:00 AM.
        </p>
        <p>
          Each additional full hour: <strong>₱1,000.00</strong>.
        </p>
        <p>Air-conditioning, sound system and mineral water are included.</p>
      </div>
      <p className="text-sm leading-6 text-muted">
        Same-day and overnight bookings are available when the Hall is free. The
        booking planner checks the event time, setup and cleanup before you pay.
      </p>
      <div className="flex flex-wrap gap-3">
        <a
          href="/book?service=hall&setup=theater"
          className="inline-flex min-h-11 items-center rounded-xl bg-booking px-5 font-bold text-main"
        >
          Book Theater Type
        </a>
        <a
          href="/book?service=hall&setup=room"
          className="inline-flex min-h-11 items-center rounded-xl border border-subtle px-5 font-semibold text-primary"
        >
          Book Room Type
        </a>
      </div>
      <p className="text-sm leading-6 text-muted">
        You can add rooms to the same reservation. Online bookings require one
        full GCash payment with a reference and screenshot. Staff verify the
        actual transaction before confirming all selected items. Timely proof
        protects your selections during review. Booking is available only when
        enabled by the hotel.
      </p>
    </section>
  );
}

const field = "block w-full rounded border border-subtle bg-white p-2";
const button =
  "min-h-11 rounded bg-primary px-4 text-white disabled:opacity-50";
function Text({
  name,
  label,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  if (type === "datetime-local")
    return (
      <ManilaDateTimeInput name={name} label={label} required={required} />
    );
  return (
    <label className="block">
      {label}
      <input
        className={field}
        name={name}
        type={type}
        required={required}
        inputMode={name === "amount" ? "decimal" : undefined}
        placeholder={name === "amount" ? "₱1,000.00" : undefined}
      />
    </label>
  );
}
function Schedule() {
  const [durationHours, setDurationHours] = useState("3");

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        Setup
        <select name="setup" className={field}>
          <option value="theater">Theater Type</option>
          <option value="room">Room Type</option>
        </select>
      </label>
      <Text name="attendees" label="Attendees" type="number" />
      <Text
        name="start"
        label="Event date and start time"
        type="datetime-local"
      />
      <div>
        Event duration (hours)
        <TimePartInput
          part="duration"
          label="Event duration (hours)"
          className={field + " min-h-11"}
          value={durationHours}
          onChange={setDurationHours}
        />
        <input
          type="hidden"
          name="minutes"
          value={String(Number(durationHours) * 60)}
        />
      </div>
    </div>
  );
}
const hallActionLabels = {
  receipt: "Record payment",
  confirm: "Confirm booking",
  start: "Start event",
  complete: "Check out guest",
  recover_inquiry: "Review and recover inquiry",
  reschedule: "Reschedule event",
  extend: "Extend event",
  no_show: "Record no-show",
  release: "Release no-show slot",
  cancel: "Cancel booking",
  manage_refund: "Manage refund",
  approve_refund: "Approve refund",
  complete_refund: "Record refund transfer",
  overtime: "Record overtime charge",
};
type HallCardAction = keyof typeof hallActionLabels;
type HallStatus = {
  ready: boolean;
  occupied: boolean;
  reserved: boolean;
  reservedUntil: string | null;
  maintenanceEnabled: boolean;
  outOfServiceId: string | null;
  outOfServiceUntil: string | null;
};
type SendHallAction = (
  event: FormEvent<HTMLFormElement>,
  path: string,
) => Promise<void>;

function HallPaymentFields({
  refund = false,
  gcashOnly = false,
  allowEarlierCashTime = false,
  fixedAmount,
}: {
  refund?: boolean;
  gcashOnly?: boolean;
  allowEarlierCashTime?: boolean;
  fixedAmount?: number;
}) {
  const [method, setMethod] = useState(gcashOnly ? "gcash" : "cash");
  const [time, setTime] = useState("");
  const [verified, setVerified] = useState(false);
  const timeName = refund ? "transferredAt" : "receivedAt";
  return (
    <div
      className="space-y-3"
      onChange={(event) => {
        const target = event.target;
        if (
          (target instanceof HTMLInputElement ||
            target instanceof HTMLSelectElement) &&
          !["verified", "evidence"].includes(target.name)
        )
          setVerified(false);
      }}
    >
      {refund ? (
        <Text name="amount" label="Amount sent (PHP)" />
      ) : fixedAmount === undefined ? (
        <Text name="amount" label="Amount received (PHP)" />
      ) : (
        <input type="hidden" name="amount" value={String(fixedAmount / 100)} />
      )}
      <label className="block">
        Method
        <select
          className={field}
          name="method"
          value={method}
          onChange={(event) => {
            setMethod(event.target.value);
            setTime("");
          }}
        >
          {!gcashOnly && <option value="cash">Cash</option>}
          <option value="gcash">GCash</option>
        </select>
      </label>
      {method === "gcash" && (
        <Text name="reference" label="GCash transaction reference" />
      )}
      {method === "cash" && !refund ? (
        allowEarlierCashTime && (
          <details>
            <summary className="cursor-pointer text-primary">
              {time ? "Edit receipt time" : "Enter an earlier receipt time"}
            </summary>
            <ManilaDateTimeInput
              name={timeName}
              label="Cash received time (Manila)"
              value={time}
              onChange={setTime}
            />
          </details>
        )
      ) : (
        <>
          <ManilaDateTimeInput
            name={timeName}
            label={
              refund
                ? "Refund transfer time (Manila)"
                : "GCash transaction time (Manila)"
            }
            value={time}
            onChange={setTime}
            required
          />
          <button
            type="button"
            className="min-h-11 rounded border border-subtle px-3 text-primary"
            onClick={() => {
              setTime(
                new Date(Date.now() + 8 * 60 * 60 * 1000)
                  .toISOString()
                  .slice(0, 16),
              );
              setVerified(false);
            }}
          >
            Use current time
          </button>
        </>
      )}
      {method === "cash" && !refund && !time && (
        <p className="text-sm text-muted">
          The system records the current Manila time when you save.
        </p>
      )}
      {refund ? (
        <Text name="evidence" label="Refund verification note" />
      ) : (
        <details>
          <summary className="cursor-pointer text-primary">
            Add a note (optional)
          </summary>
          <Text name="evidence" label="Payment note" required={false} />
        </details>
      )}
      <label className="flex items-center gap-2">
        <input
          name="verified"
          type="checkbox"
          required
          checked={verified}
          onChange={(event) => setVerified(event.target.checked)}
        />
        {refund
          ? "I verified the amount actually sent."
          : method === "cash"
            ? "I received the cash."
            : "I verified the payment in the hotel’s GCash account."}
      </label>
    </div>
  );
}

function HallExtensionForm({
  row,
  token,
  disabled,
  send,
  close,
}: {
  row: Row;
  token: string;
  disabled: boolean;
  send: SendHallAction;
  close: () => void;
}) {
  const [hours, setHours] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState<{
    added: number;
    total: number;
    end: string;
    amountDue: number;
    expectedClaim: string;
    available: boolean;
  }>();
  const canConfirm = quote?.available && quote.expectedClaim === row.claim_id;

  async function submit(event: FormEvent<HTMLFormElement>) {
    if (canConfirm) {
      await send(event, "actions/extend");
      return;
    }
    event.preventDefault();
    if (disabled || checking) return;
    setChecking(true);
    setError("");
    setQuote(undefined);
    try {
      const response = await fetch(`${apiBase}/staff/hall/extension-quote`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: row.id, hours: Number(hours) }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Extension check unavailable.");
      setQuote(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Extension check unavailable.",
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <form
      className="space-y-3 rounded-lg border border-subtle bg-canvas p-4"
      onSubmit={(event) => void submit(event)}
    >
      <h4 className="font-semibold">Extend event</h4>
      <input type="hidden" name="id" value={row.id} />
      <label className="block text-sm">
        Additional hours
        <input
          name="hours"
          type="number"
          min="1"
          max="24"
          step="1"
          required
          disabled={disabled || checking}
          className={field}
          value={hours}
          onChange={(event) => {
            setHours(event.target.value);
            setQuote(undefined);
            setError("");
          }}
        />
      </label>
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      {quote && !quote.available && (
        <p role="status" className="text-sm">
          The hall is unavailable for that extension.
        </p>
      )}
      {quote && canConfirm && (
        <>
          <input
            type="hidden"
            name="expectedClaim"
            value={quote.expectedClaim}
          />
          <input
            type="hidden"
            name="expectedAmountDue"
            value={quote.amountDue}
          />
          <div role="status" className="rounded bg-selected p-3 text-sm">
            <p>New end time {hotel.format(new Date(quote.end))}</p>
            <p>
              Extension {pesos(quote.added)} · Updated total{" "}
              {pesos(quote.total)}
            </p>
            <p className="font-semibold">
              {quote.amountDue > 0
                ? `Amount to collect ${pesos(quote.amountDue)}`
                : "No payment due"}
            </p>
          </div>
          {quote.amountDue > 0 && (
            <HallPaymentFields fixedAmount={quote.amountDue} />
          )}
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <button className={button} disabled={disabled || checking}>
          {checking
            ? "Checking…"
            : canConfirm
              ? "Confirm extension"
              : "Check extra time"}
        </button>
        {canConfirm && (
          <button
            type="button"
            className="min-h-11 px-3 text-primary"
            disabled={disabled}
            onClick={() => setQuote(undefined)}
          >
            Check again
          </button>
        )}
        <button
          type="button"
          className="min-h-11 px-3 text-primary"
          onClick={close}
        >
          Close
        </button>
      </div>
    </form>
  );
}

function HallCardActionForm({
  row,
  action,
  finances,
  disabled,
  send,
  close,
  refundFlow = false,
}: {
  row: Row;
  action: HallCardAction;
  finances?: Finances;
  disabled: boolean;
  send: SendHallAction;
  close: () => void;
  refundFlow?: boolean;
}) {
  const refund = action === "complete_refund";
  const refundApprovals = finances?.refunds.filter((entry) => entry.pending);
  return (
    <form
      className="space-y-3 rounded-lg border border-subtle bg-canvas p-4"
      onSubmit={(event) => void send(event, "actions/" + action)}
    >
      <h4 className="font-semibold">
        {refundFlow ? hallActionLabels.manage_refund : hallActionLabels[action]}
      </h4>
      <input type="hidden" name="id" value={row.id} />
      {refundFlow && (
        <p className="text-sm">
          {refund
            ? "After sending money to the guest, record the actual amount of each transfer here."
            : "Approve the amount to return. You can record repayment here after returning the money."}
        </p>
      )}
      {action === "complete" && (
        <p className="text-sm">
          Confirm the guest has finished using the hall. Checkout records their
          departure time.
        </p>
      )}
      {["reschedule", "recover_inquiry"].includes(action) && <Schedule />}
      {[
        "reschedule",
        "recover_inquiry",
        "no_show",
        "release",
        "cancel",
        "approve_refund",
        "overtime",
      ].includes(action) && <Text name="reason" label="Reason" />}
      {["approve_refund", "overtime"].includes(action) && (
        <Text name="amount" label="Amount (PHP)" />
      )}
      {refund && (
        <label className="block">
          Pending refund approval
          <select
            name="approval"
            required
            className={field}
            defaultValue={
              refundApprovals?.length === 1 ? refundApprovals[0].id : ""
            }
          >
            <option value="">Choose approved refund</option>
            {refundApprovals?.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {pesos(entry.remainingAmount)} still due · {entry.reason}
              </option>
            ))}
          </select>
        </label>
      )}
      {(action === "receipt" || refund) && (
        <HallPaymentFields
          refund={refund}
          gcashOnly={refund && Boolean(row.unifiedReservationId)}
          allowEarlierCashTime={action === "receipt"}
        />
      )}
      <div className="flex flex-wrap gap-3">
        <button
          disabled={disabled || (refund && !refundApprovals?.length)}
          className={button}
        >
          {action === "complete"
            ? "Confirm checkout"
            : hallActionLabels[action]}
        </button>
        <button
          type="button"
          className="min-h-11 px-3 text-primary"
          onClick={close}
        >
          Close
        </button>
      </div>
    </form>
  );
}

function HallCardActions({
  row,
  token,
  now,
  possibleNoShow,
  disabled,
  action,
  finances,
  financeLoadFailed,
  openHistory,
  send,
  choose,
  close,
  loadHistory,
  reloadRefund,
}: {
  row: Row;
  token: string;
  now: number;
  possibleNoShow: boolean;
  disabled: boolean;
  action?: HallCardAction;
  finances?: Finances;
  financeLoadFailed: boolean;
  openHistory: boolean;
  send: SendHallAction;
  choose: (action: HallCardAction) => void;
  close: () => void;
  loadHistory: () => void;
  reloadRefund: () => void;
}) {
  const refundFlow = action === "manage_refund";
  const formAction = refundFlow
    ? finances &&
      (finances.refunds.some((entry) => entry.pending)
        ? "complete_refund"
        : "approve_refund")
    : action;
  const onlineInquiry =
    Boolean(row.unifiedReservationId) && row.status === "inquiry";
  const inquiry = row.status === "inquiry" && !onlineInquiry;
  const confirmed = row.status === "confirmed";
  const inProgress = row.status === "in_progress";
  const completed = row.status === "completed";
  const walkIn = row.channel === "walk_in" && !row.unifiedReservationId;
  const balance = Number(row.balance);
  const showSeparateBalance =
    balance > 0 && (inProgress || (confirmed && walkIn));
  const start = row.quote ? Date.parse(row.quote.start) : null;
  const end = row.quote ? Date.parse(row.quote.end) : null;
  const primary: HallCardAction | undefined = inquiry
    ? row.depositDue === 0
      ? "confirm"
      : "receipt"
    : inProgress
      ? "complete"
      : confirmed && walkIn
        ? "start"
        : (confirmed || completed) && balance > 0
          ? "receipt"
          : confirmed
            ? "start"
            : undefined;
  let actionBlocker = "";
  if (primary === "start") {
    if (start === null || end === null || now < start || now >= end)
      actionBlocker = "Start is available during the scheduled event.";
    else if (!row.ready) actionBlocker = "Mark the Hall Ready before starting.";
    else if (row.startPaymentIssue) actionBlocker = row.startPaymentIssue;
  }
  if (
    primary === "confirm" &&
    Date.parse(row.quote_input.start + ":00+08:00") <= now
  )
    actionBlocker = "Choose a new time under More actions.";
  const exceptions: HallCardAction[] = [];
  if (inquiry) exceptions.push("recover_inquiry", "cancel");
  if (confirmed) {
    if (start !== null && now < start) exceptions.push("reschedule");
    exceptions.push("cancel");
    if (possibleNoShow) exceptions.push("no_show");
  }
  if ((confirmed || inProgress) && end !== null && now < end)
    exceptions.push("extend");
  const latePayment =
    row.status === "cancelled" ||
    row.status === "no_show" ||
    (onlineInquiry && row.onlineState === "expired");
  if (latePayment) exceptions.push("receipt");
  if (row.status === "no_show" && row.ready && !row.released_at)
    exceptions.push("release");
  if (
    completed &&
    end !== null &&
    row.actual_end &&
    Date.parse(row.actual_end) > end &&
    Number(row.overtime) === 0
  )
    exceptions.push("overtime");
  if (!onlineInquiry && Number(row.collected) > Number(row.refunded))
    exceptions.push("manage_refund");

  return (
    <div className="space-y-3 border-t border-subtle pt-3">
      {inquiry && row.inquiryPrice !== undefined && (
        <p className="text-sm">
          {row.depositDue
            ? `Deposit still due: ${pesos(row.depositDue)}`
            : "Deposit met"}
        </p>
      )}
      {primary === "receipt" || primary === "complete"
        ? action !== primary && (
            <button
              type="button"
              className={button}
              disabled={disabled}
              onClick={() => choose(primary)}
            >
              {primary === "complete"
                ? hallActionLabels.complete
                : inquiry
                  ? "Record payment"
                  : "Collect balance"}
            </button>
          )
        : primary && (
            <form onSubmit={(event) => void send(event, "actions/" + primary)}>
              <input type="hidden" name="id" value={row.id} />
              <button
                className={button}
                disabled={disabled || Boolean(actionBlocker)}
              >
                {hallActionLabels[primary]}
              </button>
              {actionBlocker && (
                <p className="mt-1 text-sm text-muted">{actionBlocker}</p>
              )}
            </form>
          )}
      {showSeparateBalance && action !== "receipt" && (
        <button
          type="button"
          className="min-h-11 rounded border border-subtle px-3 text-primary"
          disabled={disabled}
          onClick={() => choose("receipt")}
        >
          Collect balance
        </button>
      )}
      {refundFlow && !finances && (
        <div className="space-y-3 rounded-lg border border-subtle bg-canvas p-4">
          <h4 className="font-semibold">Manage refund</h4>
          {financeLoadFailed ? (
            <>
              <p role="alert" className="text-sm">
                Refund details could not be loaded.
              </p>
              <button type="button" className={button} onClick={reloadRefund}>
                Retry
              </button>
            </>
          ) : (
            <p role="status" className="text-sm">
              Checking refund status…
            </p>
          )}
          <button
            type="button"
            className="min-h-11 px-3 text-primary"
            onClick={close}
          >
            Close
          </button>
        </div>
      )}
      {formAction === "extend" ? (
        <HallExtensionForm
          row={row}
          token={token}
          disabled={disabled}
          send={send}
          close={close}
        />
      ) : (
        formAction && (
          <HallCardActionForm
            key={formAction}
            row={row}
            action={formAction}
            finances={finances}
            disabled={disabled}
            send={send}
            close={close}
            refundFlow={refundFlow}
          />
        )
      )}
      {exceptions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-primary">
            More actions
          </summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {exceptions.map((option) => (
              <button
                key={option}
                type="button"
                className="min-h-11 rounded border border-subtle px-3 text-primary"
                disabled={disabled}
                onClick={() => choose(option)}
              >
                {option === "receipt"
                  ? "Record late payment"
                  : hallActionLabels[option]}
              </button>
            ))}
          </div>
        </details>
      )}
      <details
        aria-label="Hall financial history"
        className="text-sm"
        open={openHistory || undefined}
        onToggle={(event) => {
          if (event.currentTarget.open) loadHistory();
        }}
      >
        <summary className="min-h-11 cursor-pointer font-semibold text-primary">
          Payment and refund history
        </summary>
        {!finances ? (
          <p>Loading payment history…</p>
        ) : (
          <>
            {finances.receipts.length === 0 && <p>No verified payments.</p>}
            {finances.receipts.map((receipt) => (
              <p key={receipt.id}>
                {hotel.format(new Date(receipt.received_at))} · {receipt.method}{" "}
                · {pesos(receipt.amount)} ·{" "}
                {receipt.reference ?? "Cash received"} · {receipt.evidence}
              </p>
            ))}
            {finances.refunds.map((refund) => (
              <div key={refund.id}>
                <p>
                  {pesos(refund.amount)} approved ·{" "}
                  {pesos(refund.transferredAmount)} sent ·{" "}
                  {pesos(refund.remainingAmount)} still due
                </p>
                <p>{refund.reason}</p>
                {refund.transfers.map((transfer) => (
                  <p key={transfer.id}>
                    {hotel.format(new Date(transfer.transferred_at))} ·{" "}
                    {transfer.method} · {pesos(transfer.amount)}{" "}
                    {transfer.reference}
                  </p>
                ))}
              </div>
            ))}
          </>
        )}
      </details>
    </div>
  );
}

const settingsLabels: Record<string, string> = {
  horizon: "How far ahead to book (days)",
  preparation: "Setup time (minutes)",
  cleanup: "Cleanup time (minutes)",
  noShowGrace: "Wait before marking no-show (minutes)",
  reminder: "Remind before event ends (minutes)",
};

export default function HallDesk({ token }: { token: string }) {
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>();
  const [message, setMessage] = useState("");
  const [quoteMessage, setQuoteMessage] = useState("");
  const [quoteDeposit, setQuoteDeposit] = useState<number>();
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now);
  const [activeAction, setActiveAction] = useState<{
    id: string;
    action: HallCardAction;
  }>();
  const [hall, setHall] = useState<HallStatus>();
  const [tab, setTab] = useState("calendar");
  const [retry, setRetry] = useState<{ payload: string; key: string }>();
  const [pending, setPending] = useState<PendingHallCommand>();
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [selected, setSelected] = useState(searchParams.get("item") ?? "");
  const [finances, setFinances] = useState<Record<string, Finances>>({});
  const [failedFinancesId, setFailedFinancesId] = useState<string>();
  useEffect(() => {
    setEntries([]);
    setHall(undefined);
    setActiveAction(undefined);
    setFinances({});
    setFailedFinancesId(undefined);
    setRecoveryFailed(false);
    setPending(pendingHallCommand(sessionStorage, token).load());
    const timer = setInterval(() => setRevision((v) => v + 1), 30000);
    return () => clearInterval(timer);
  }, [token]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void fetch(apiBase + "/staff/hall/reservations/" + selected + "/finances", {
      headers: { Authorization: "Bearer " + token },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Financial history unavailable.");
        const result = await response.json();
        if (!controller.signal.aborted) {
          setFailedFinancesId((current) =>
            current === selected ? undefined : current,
          );
          setFinances((current) => ({ ...current, [selected]: result }));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFailedFinancesId(selected);
          setMessage("Financial history unavailable.");
        }
      });
    return () => controller.abort();
  }, [selected, token, revision]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const headers = { Authorization: "Bearer " + token };
    void Promise.all(
      ["reservations?page=" + page, "settings"].map(async (path) => {
        const response = await fetch(apiBase + "/staff/hall/" + path, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Function Hall is unavailable.");
        return response.json();
      }),
    )
      .then(([calendar, config]) => {
        if (!controller.signal.aborted) {
          setEntries(calendar.entries);
          setHall(calendar.hall);
          setSettings(config);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Function Hall is unavailable.");
      });
    return () => controller.abort();
  }, [token, revision, page]);
  function clearQuote() {
    setQuoteMessage("");
    setQuoteDeposit(undefined);
  }
  function loadFreshRefund(id: string) {
    setSelected(id);
    setFailedFinancesId(undefined);
    setFinances((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function showWalkInBooking(id: string) {
    setSelected(id);
    setPage(1);
    setTab("calendar");
  }
  async function send(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    if (busy || (pending && path.startsWith("actions/"))) return;
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const quoteStillMatches = () =>
      form.isConnected &&
      Array.from(new FormData(form)).every(
        ([name, value]) => values[name] === value,
      );
    const data: Record<string, unknown> = { ...values };
    if (
      [
        "actions/reschedule",
        "actions/extend",
        "actions/recover_inquiry",
      ].includes(path)
    )
      data.expectedClaim ??= entries.find(
        (entry) => entry.id === data.id,
      )?.claim_id;
    for (const key of [
      "attendees",
      "minutes",
      "hours",
      "expectedAmountDue",
      ...Object.keys(settingsLabels),
    ])
      if (key in data) data[key] = Number(data[key]);
    if (data.receivedAt === "") delete data.receivedAt;
    else if (typeof data.receivedAt === "string")
      data.receivedAt += ":00+08:00";
    if (typeof data.transferredAt === "string")
      data.transferredAt += ":00+08:00";
    if (data.verified === "on") data.verified = true;
    if (typeof data.amount === "string") {
      try {
        data.amount = hallCentavos(data.amount);
      } catch (error) {
        setMessage((error as Error).message);
        return;
      }
    }
    const commandAction = path.slice(8) as HallCardAction;
    const directBooking = path === "actions/book_walk_in";
    const extending = path === "actions/extend";
    const actionLabel = directBooking
      ? "Confirm walk-in booking and record payment"
      : path === "actions/ready"
        ? "Confirm the Hall is clean and ready"
        : path === "actions/take_out_of_service"
          ? "Take the hall out of service"
          : path === "actions/end_out_of_service"
            ? "End the out-of-service period"
            : (hallActionLabels[commandAction] ??
              "Record " + path.slice(8).replaceAll("_", " "));
    if (
      path.startsWith("actions/") &&
      !globalThis.confirm(
        actionLabel +
          (data.id
            ? " for " +
              (entries.find((row) => row.id === data.id)?.organizer ?? data.id)
            : "") +
          (typeof data.amount === "number" ? " · " + pesos(data.amount) : "") +
          "?",
      )
    )
      return;
    setBusy(true);
    setMessage("");
    if (path === "quote") clearQuote();
    let command: PendingHallCommand | undefined;
    try {
      const headers = {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      };
      const payload = JSON.stringify(data);
      const fingerprint = path + payload;
      const key =
        retry?.payload === fingerprint
          ? retry.key
          : globalThis.crypto.randomUUID();
      setRetry({ payload: fingerprint, key });
      if (path.startsWith("actions/")) {
        const submitted = { path, payload, key };
        pendingHallCommand(sessionStorage, token).save(submitted);
        command = submitted;
      }
      const response = await fetch(apiBase + "/staff/hall/" + path, {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": key },
        body: payload,
        signal: command ? AbortSignal.timeout(15_000) : undefined,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          setRetry(undefined);
          if (command) {
            pendingHallCommand(sessionStorage, token).clear();
            command = undefined;
          }
        }
        if (result.issue) {
          if (extending && result.receiptId) {
            setActiveAction(undefined);
            setMessage(
              `Payment recorded. The extension was not applied. ${result.issue}`,
            );
            setRevision((v) => v + 1);
            return;
          }
          if (directBooking && result.receiptId && result.id) {
            clearQuote();
            showWalkInBooking(result.id);
            setMessage(
              `Payment recorded. The booking is still an inquiry. ${result.issue}`,
            );
            setRevision((v) => v + 1);
            return;
          }
          setRevision((v) => v + 1);
        }
        throw new Error(result.error ?? result.issue ?? "Action unavailable.");
      }
      setRetry(undefined);
      if (command) {
        pendingHallCommand(sessionStorage, token).clear();
        command = undefined;
      }
      if (path === "quote") {
        if (quoteStillMatches()) {
          setQuoteMessage(
            pesos(result.total) +
              (result.available
                ? " · Available when checked"
                : " · Protected interval unavailable"),
          );
          if (result.available) setQuoteDeposit(Math.ceil(result.total / 2));
        }
      } else {
        const refundApproved = path === "actions/approve_refund";
        const refundRecorded = path === "actions/complete_refund";
        const refundRemaining = result.refundRemainingCentavos ?? 0;
        const reservationId = typeof data.id === "string" ? data.id : undefined;
        const keepRefundOpen =
          reservationId &&
          ((refundApproved && Number(data.amount) > 0) ||
            (refundRecorded &&
              (refundRemaining > 0 ||
                (finances[reservationId]?.refunds.filter(
                  (entry) => entry.pending,
                ).length ?? 0) > 1)));
        setMessage(
          directBooking
            ? "Walk-in booking confirmed and payment recorded."
            : extending
              ? "Event extended."
              : path === "actions/receipt"
                ? "Payment recorded."
                : path === "actions/confirm"
                  ? "Booking confirmed."
                  : refundApproved
                    ? keepRefundOpen
                      ? "Refund approved. Record it after returning the money."
                      : "Refund decision recorded."
                    : refundRecorded
                      ? refundRemaining > 0
                        ? `Transfer recorded. ${pesos(refundRemaining)} still due.`
                        : "Refund transfer recorded."
                      : path === "actions/start"
                        ? "Event started."
                        : path === "actions/complete"
                          ? "Checkout recorded. Clean and prepare the hall before marking it ready."
                          : path === "actions/ready"
                            ? "Hall readiness saved."
                            : path === "actions/take_out_of_service"
                              ? "The hall is out of service for the selected period."
                              : path === "actions/end_out_of_service"
                                ? "Out-of-service period ended. Mark the hall ready when it is prepared."
                                : "Action recorded.",
        );
        if (directBooking && result.id) {
          clearQuote();
          showWalkInBooking(result.id);
        }
        if ((refundApproved || refundRecorded) && reservationId)
          loadFreshRefund(reservationId);
        else if (reservationId) setSelected(reservationId);
        if (!keepRefundOpen) setActiveAction(undefined);
        notifySuccess("Function Hall action recorded.");
        setRevision((v) => v + 1);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Action unavailable.";
      if (path === "quote") {
        if (quoteStillMatches()) setQuoteMessage(errorMessage);
      } else if (command) {
        setRecoveryFailed(false);
        setPending(command);
      } else {
        setMessage(errorMessage);
      }
    } finally {
      setBusy(false);
    }
  }
  const showRecoveredCommand = useEffectEvent(
    (
      pending: PendingHallCommand,
      recovered: {
        id?: string;
        receiptId?: string;
        issue?: string;
        error?: string;
      },
    ) => {
      const walkInPaymentRecovered =
        pending.path === "actions/book_walk_in" &&
        recovered.receiptId &&
        recovered.id;
      const extensionPaymentRecovered =
        pending.path === "actions/extend" && recovered.receiptId;
      if (walkInPaymentRecovered) {
        clearQuote();
        showWalkInBooking(walkInPaymentRecovered);
      }
      if (!recovered.error) setActiveAction(undefined);
      setMessage(
        recovered.error ??
          (recovered.issue
            ? walkInPaymentRecovered
              ? `Payment recorded. The booking is still an inquiry. ${recovered.issue}`
              : extensionPaymentRecovered
                ? `Payment recorded. The extension was not applied. ${recovered.issue}`
                : recovered.issue
            : "Previous Hall action recorded. Review the updated reservation."),
      );
      if (!recovered.issue && !recovered.error)
        notifySuccess("Function Hall action recorded.");
      setRevision((v) => v + 1);
    },
  );
  useEffect(() => {
    const saved = pendingHallCommand(sessionStorage, token);
    if (!pending || saved.load()?.key !== pending.key) return;
    const controller = new AbortController();
    const signal = () =>
      AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]);
    const headers = { Authorization: "Bearer " + token };
    const base = apiBase + "/staff/hall/";
    void (async () => {
      try {
        const lookup = await fetch(base + "commands/" + pending.key, {
          headers,
          signal: signal(),
        });
        const record = await lookup.json();
        if (controller.signal.aborted) return;
        let result = record.result;
        if (lookup.status === 404 && typeof record.error === "string") {
          const replay = await fetch(base + pending.path, {
            method: "POST",
            headers: {
              ...headers,
              "Content-Type": "application/json",
              "Idempotency-Key": pending.key,
            },
            body: pending.payload,
            signal: signal(),
          });
          result = await replay.json();
          const rejected =
            [400, 404, 409, 422].includes(replay.status) &&
            typeof result?.error === "string";
          if (
            !replay.ok &&
            !rejected &&
            !(replay.status === 409 && result?.issue)
          )
            throw new Error("Hall action outcome is still unknown.");
        } else if (!lookup.ok) {
          throw new Error("Hall action outcome is still unknown.");
        }
        if (controller.signal.aborted) return;
        if (!result || typeof result !== "object" || Array.isArray(result))
          throw new Error("Hall action result is unavailable.");
        saved.clear();
        setPending(undefined);
        setRetry(undefined);
        showRecoveredCommand(pending, result);
      } catch {
        if (!controller.signal.aborted) setRecoveryFailed(true);
      }
    })();
    return () => controller.abort();
  }, [pending, token]);
  return (
    <section className="mt-6 space-y-5">
      <h2 className="text-2xl font-semibold">Function Hall</h2>
      {pending && (
        <p role="status" className="text-sm">
          {recoveryFailed
            ? "Could not verify the previous Hall action. Reconnect and reload this page to try again."
            : "Checking the previous Hall action…"}
        </p>
      )}
      <nav
        aria-label="Function Hall"
        className="flex flex-wrap gap-4 text-primary"
      >
        {[
          ["calendar", "Calendar"],
          ["new", "New booking"],
          ["settings", "Settings"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setMessage("");
              clearQuote();
            }}
            className="min-h-11"
          >
            {label}
          </button>
        ))}
      </nav>
      {message && (
        <p role="status" className="break-words rounded bg-canvas p-3">
          {message}
        </p>
      )}
      {tab === "new" && (
        <form
          className="space-y-3"
          onSubmit={(event) =>
            void send(
              event,
              quoteDeposit === undefined ? "quote" : "actions/book_walk_in",
            )
          }
        >
          <div onChange={clearQuote}>
            <Schedule />
          </div>
          {quoteMessage && (
            <p
              role="status"
              className="break-words rounded bg-canvas px-3 py-2 text-sm"
            >
              {quoteMessage}
            </p>
          )}
          {quoteDeposit !== undefined && (
            <fieldset className="min-w-0 rounded border border-subtle px-4 pb-4">
              <legend className="px-2 font-semibold">Payment</legend>
              <p className="mb-3 text-sm">
                Minimum deposit {pesos(quoteDeposit)}
              </p>
              <HallPaymentFields />
            </fieldset>
          )}
          <button
            type="submit"
            disabled={busy || (quoteDeposit !== undefined && !!pending)}
            className={button}
          >
            {quoteDeposit === undefined
              ? "Check price and availability"
              : "Confirm walk-in booking"}
          </button>
        </form>
      )}
      {tab === "settings" && settings && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          key={revision}
          onSubmit={(event) => void send(event, "actions/settings")}
        >
          {Object.entries(settingsLabels).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                className={field}
                name={key}
                type="number"
                min="0"
                required
                defaultValue={settings[key]}
              />
            </label>
          ))}
          <button disabled={busy} className={button}>
            Save settings
          </button>
        </form>
      )}
      {tab === "calendar" && (
        <>
          {hall && (
            <section
              className="space-y-3 rounded-xl border border-subtle p-4"
              aria-label="Hall status"
            >
              <p className="font-semibold">
                {hall.occupied
                  ? "Event in progress"
                  : hall.outOfServiceId
                    ? "Hall is out of service"
                    : hall.ready
                      ? "Hall is clean and ready"
                      : "Hall needs cleaning or setup"}
              </p>
              {hall.outOfServiceUntil && (
                <p className="text-sm">
                  Out of service until{" "}
                  {hotel.format(new Date(hall.outOfServiceUntil))}.
                </p>
              )}
              {hall.reserved && !hall.occupied && (
                <p className="text-sm">
                  {hall.reservedUntil ? (
                    <>
                      Current time slot is held until{" "}
                      {hotel.format(new Date(hall.reservedUntil))}.
                    </>
                  ) : (
                    "Current time slot is held."
                  )}
                </p>
              )}
              {!hall.ready && !hall.occupied && !hall.outOfServiceId && (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => void send(event, "actions/ready")}
                >
                  <input
                    type="hidden"
                    name="reason"
                    value="Staff confirmed the Hall is clean and ready."
                  />
                  <button disabled={busy || !!pending} className={button}>
                    Mark clean and ready
                  </button>
                </form>
              )}
              {hall.maintenanceEnabled &&
                !hall.occupied &&
                (hall.outOfServiceId ? (
                  <form
                    onSubmit={(event) =>
                      void send(event, "actions/end_out_of_service")
                    }
                  >
                    <input
                      type="hidden"
                      name="claim"
                      value={hall.outOfServiceId}
                    />
                    <button disabled={busy || !!pending} className={button}>
                      End out-of-service period
                    </button>
                  </form>
                ) : (
                  <details className="text-sm">
                    <summary className="cursor-pointer font-semibold text-primary">
                      Take out of service
                    </summary>
                    <form
                      className="mt-2 space-y-3"
                      onSubmit={(event) =>
                        void send(event, "actions/take_out_of_service")
                      }
                    >
                      <ManilaDateTimeInput
                        label="Out of service until"
                        name="until"
                        required
                      />
                      <button disabled={busy || !!pending} className={button}>
                        Take out of service
                      </button>
                    </form>
                  </details>
                ))}
            </section>
          )}
          {!settings && !message && <p role="status">Loading calendar…</p>}
          {settings && entries.length === 0 && (
            <p className="staff-empty">No reservations on this page.</p>
          )}
          {["In progress", "Upcoming and inquiries", "Past events"].map(
            (group) => {
              const grouped = entries.filter((row) =>
                group === "In progress"
                  ? row.status === "in_progress"
                  : group === "Upcoming and inquiries"
                    ? ["inquiry", "confirmed"].includes(row.status)
                    : !["inquiry", "confirmed", "in_progress"].includes(
                        row.status,
                      ),
              );
              return (
                grouped.length > 0 && (
                  <section key={group} className="space-y-3" aria-label={group}>
                    <h3 className="text-lg font-semibold">
                      {group}{" "}
                      <span className="text-sm text-muted">
                        ({grouped.length})
                      </span>
                    </h3>
                    {grouped.map((row) => {
                      const end = row.quote ? Date.parse(row.quote.end) : null;
                      const start = row.quote
                        ? Date.parse(row.quote.start)
                        : null;
                      const remainingMs = end === null ? null : end - now;
                      const remainingSeconds = Math.max(
                        0,
                        Math.ceil((remainingMs ?? 0) / 1000),
                      );
                      const price =
                        row.inquiryPrice ??
                        BigInt(row.total) + BigInt(row.overtime);
                      const balance =
                        row.inquiryPrice === undefined
                          ? row.balance
                          : Math.max(
                              0,
                              row.inquiryPrice -
                                Number(row.collected) +
                                Number(row.refunded),
                            );
                      const possibleNoShow =
                        row.status === "confirmed" &&
                        start !== null &&
                        now >= start + (settings?.noShowGrace ?? 60) * 60000;
                      return (
                        <article
                          key={row.id}
                          className="space-y-2 rounded-xl border border-subtle p-4"
                        >
                          <h3 className="font-semibold">
                            {row.organizer} · {readableLabel(row.status)}
                          </h3>
                          {row.unifiedReservationId && (
                            <p className="text-sm text-primary">
                              Online booking ·{" "}
                              <Link
                                className="underline"
                                to={`/staff/reservations/${row.unifiedReservationId}`}
                              >
                                View all items and shared payment
                              </Link>
                            </p>
                          )}
                          {row.unifiedReservationId &&
                            row.status === "inquiry" &&
                            (row.onlineState === "proof_pending_review" ? (
                              <Link
                                className={button + " inline-flex items-center"}
                                to="/staff/payments"
                              >
                                Verify payment
                              </Link>
                            ) : (
                              <p className="text-sm text-muted">
                                {row.onlineState === "expired"
                                  ? "Online payment hold expired."
                                  : "Waiting for the guest to submit GCash payment proof."}
                              </p>
                            ))}
                          {!!row.changeRequests?.length && (
                            <details className="rounded border border-subtle p-3">
                              <summary className="cursor-pointer font-semibold">
                                Guest change requests
                              </summary>
                              <p className="my-2 text-sm">
                                Requests need staff review and availability
                                checking. History is not an approval status.
                              </p>
                              {row.changeRequests.map((request) => (
                                <div
                                  key={request.id}
                                  className="my-3 border-t border-subtle pt-2 text-sm"
                                >
                                  <p className="font-semibold">
                                    {request.kind === "extend"
                                      ? "Extension"
                                      : "Reschedule"}{" "}
                                    requested{" "}
                                    {hotel.format(
                                      new Date(request.recorded_at),
                                    )}
                                  </p>
                                  <p>{request.reason}</p>
                                  {request.input.start && (
                                    <p>
                                      Requested start:{" "}
                                      {hotel.format(
                                        new Date(
                                          request.input.start +
                                            (request.input.start.length === 16
                                              ? ":00+08:00"
                                              : ""),
                                        ),
                                      )}
                                    </p>
                                  )}
                                  {request.input.setup && (
                                    <p>
                                      Setup:{" "}
                                      {request.input.setup === "theater"
                                        ? "Theater Type"
                                        : "Room Type"}
                                    </p>
                                  )}
                                  {request.input.attendees !== undefined && (
                                    <p>Attendees: {request.input.attendees}</p>
                                  )}
                                  {request.input.minutes !== undefined && (
                                    <p>
                                      Duration: {request.input.minutes / 60}{" "}
                                      hours
                                    </p>
                                  )}
                                  {request.input.hours !== undefined && (
                                    <p>
                                      Additional hours: {request.input.hours}
                                    </p>
                                  )}
                                </div>
                              ))}
                            </details>
                          )}
                          <p>
                            {readableLabel(row.channel)} ·{" "}
                            {row.quote
                              ? hotel.format(new Date(row.quote.start)) +
                                " – " +
                                hotel.format(new Date(row.quote.end))
                              : hotel.format(
                                  new Date(row.quote_input.start + ":00+08:00"),
                                ) + " (inquiry)"}
                          </p>
                          <p>
                            Price {pesos(String(price))} · Paid{" "}
                            {pesos(row.collected)} · Balance {pesos(balance)}
                            {Number(row.refunded) > 0 && (
                              <> · Refunded {pesos(row.refunded)}</>
                            )}
                            {Number(row.refundDue) > 0 && (
                              <> · Refund due {pesos(Number(row.refundDue))}</>
                            )}
                          </p>

                          {row.requests && (
                            <p className="break-words">
                              Requests: {row.requests}
                            </p>
                          )}
                          {row.payment_resolution && (
                            <p className="font-medium">
                              Payment needs staff resolution.
                            </p>
                          )}
                          {(row.preparation_conflict ||
                            (row.status === "confirmed" &&
                              start !== null &&
                              now >=
                                start - (settings?.preparation ?? 0) * 60000 &&
                              entries.some(
                                (entry) =>
                                  entry.status === "in_progress" &&
                                  entry.id !== row.id,
                              ))) && (
                            <p role="alert">
                              Preparation is due while the hall is occupied.
                            </p>
                          )}
                          {row.status === "in_progress" &&
                            remainingMs !== null && (
                              <div
                                className={
                                  remainingMs <= 0
                                    ? "rounded-lg bg-red-50 p-3 text-red-800"
                                    : "rounded-lg bg-canvas p-3 text-primary"
                                }
                              >
                                <p className="text-sm font-semibold">
                                  {remainingMs <= 0
                                    ? "Scheduled time ended"
                                    : remainingMs <=
                                        (settings?.reminder ?? 15) * 60000
                                      ? "Time remaining · Ending soon"
                                      : "Time remaining"}
                                </p>
                                <p
                                  role="timer"
                                  aria-label="Time remaining"
                                  className="text-3xl font-semibold tabular-nums"
                                >
                                  {[
                                    Math.floor(remainingSeconds / 3600),
                                    Math.floor(remainingSeconds / 60) % 60,
                                    remainingSeconds % 60,
                                  ]
                                    .map((part) =>
                                      String(part).padStart(2, "0"),
                                    )
                                    .join(":")}
                                </p>
                              </div>
                            )}
                          {row.status === "completed" && row.actual_end && (
                            <p className="text-sm">
                              Checked out{" "}
                              {hotel.format(new Date(row.actual_end))}
                            </p>
                          )}
                          {possibleNoShow && (
                            <p>Potential no-show. Staff review required.</p>
                          )}
                          {row.status === "completed" &&
                            row.actual_end &&
                            end !== null &&
                            Date.parse(row.actual_end) > end && (
                              <p>Unapproved overrun recorded.</p>
                            )}
                          <HallCardActions
                            row={row}
                            token={token}
                            now={now}
                            possibleNoShow={possibleNoShow}
                            disabled={busy || !!pending}
                            action={
                              activeAction?.id === row.id
                                ? activeAction.action
                                : undefined
                            }
                            finances={finances[row.id]}
                            financeLoadFailed={failedFinancesId === row.id}
                            openHistory={searchParams.get("item") === row.id}
                            send={send}
                            choose={(action) => {
                              if (action === "manage_refund") {
                                loadFreshRefund(row.id);
                                setRevision((v) => v + 1);
                              }
                              setActiveAction({ id: row.id, action });
                            }}
                            close={() => setActiveAction(undefined)}
                            loadHistory={() => setSelected(row.id)}
                            reloadRefund={() => {
                              loadFreshRefund(row.id);
                              setRevision((v) => v + 1);
                            }}
                          />
                          {row.unifiedReservationId &&
                            (Number(row.refundDue) > 0 ||
                              Number(row.refunded) > 0) && (
                              <StaffRefundIssue
                                token={token}
                                kind="hall"
                                itemId={row.id}
                              />
                            )}
                        </article>
                      );
                    })}
                  </section>
                )
              );
            },
          )}
          <div className="flex gap-4">
            {page > 1 && (
              <button onClick={() => setPage((v) => v - 1)}>Previous</button>
            )}
            {entries.length === 50 && (
              <button onClick={() => setPage((v) => v + 1)}>Next</button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
