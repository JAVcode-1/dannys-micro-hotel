import { readableLabel } from "./presentation";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import type { FormEvent } from "react";
import ManilaDateTimeInput from "./ManilaDateTimeInput";
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
  balance: string;
  actual_end: string | null;
  requests: string | null;
  quote_input: { start: string };
  quote: { start: string; end: string } | null;
};
type Report = {
  gross: string;
  refunds: string;
  net: string;
  days: { day: string; gross: string; refunds: string; net: string }[];
  utilization: {
    actual_minutes: number;
    bookings: number;
    scheduled_minutes: number;
    preparation_minutes: number;
    cleanup_minutes: number;
  };
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
    reason: string;
    pending: boolean;
    method: string | null;
    reference: string | null;
    transferred_at: string | null;
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
      <div className="rounded-xl bg-selected p-5 text-sm leading-7">
        <p>
          <strong>Three-hour package: ₱3,000.00</strong> for starts from 8:00 AM to
          before 5:00 PM.
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
        Same-day and overnight bookings are available when the Hall is free.
        The booking planner checks the event time, setup and cleanup before you pay.
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
      <Text name="start" label="Manila event start" type="datetime-local" />
      <label>
        Event duration
        <select name="minutes" className={field} defaultValue="180">
          {Array.from({ length: 22 }, (_, index) => index + 3).map((hours) => (
            <option key={hours} value={hours * 60}>
              {hours} hours
            </option>
          ))}
        </select>
      </label>
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
  approve_refund: "Approve refund",
  complete_refund: "Record completed refund",
  overtime: "Record overtime charge",
};
type HallCardAction = keyof typeof hallActionLabels;
type HallStatus = { ready: boolean; occupied: boolean };
type SendHallAction = (event: FormEvent<HTMLFormElement>, path: string) => Promise<void>;

function HallCardActionForm({
  row,
  action,
  finances,
  disabled,
  send,
  close,
}: {
  row: Row;
  action: HallCardAction;
  finances?: Finances;
  disabled: boolean;
  send: SendHallAction;
  close: () => void;
}) {
  const refund = action === "complete_refund";
  const [method, setMethod] = useState(refund && row.unifiedReservationId ? "gcash" : "cash");
  const [time, setTime] = useState("");
  const [verified, setVerified] = useState(false);
  const payment = action === "receipt" || refund;
  const timeName = refund ? "transferredAt" : "receivedAt";
  const refundApprovals = finances?.refunds.filter((entry) => entry.pending);
  return (
    <form
      className="space-y-3 rounded-lg border border-subtle bg-canvas p-4"
      onSubmit={(event) => void send(event, "actions/" + action)}
      onChange={(event) => {
        const target = event.target;
        if (
          payment &&
          (target instanceof HTMLInputElement || target instanceof HTMLSelectElement) &&
          !["verified", "evidence"].includes(target.name)
        )
          setVerified(false);
      }}
    >
      <h4 className="font-semibold">{hallActionLabels[action]}</h4>
      <input type="hidden" name="id" value={row.id} />
      {action === "complete" && (
        <p className="text-sm">
          Confirm the guest has finished using the hall. Checkout records their departure time.
        </p>
      )}
      {["reschedule", "recover_inquiry"].includes(action) && <Schedule />}
      {["reschedule", "recover_inquiry", "extend", "no_show", "release", "cancel", "approve_refund", "overtime"].includes(action) && (
        <Text name="reason" label="Reason" />
      )}
      {action === "extend" && (
        <Text name="hours" label="Additional full hours" type="number" />
      )}
      {["receipt", "approve_refund", "overtime"].includes(action) && (
        <Text name="amount" label={action === "receipt" ? "Amount received (PHP)" : "Amount (PHP)"} />
      )}
      {refund && (
        <label className="block">
          Pending refund approval
          <select name="approval" required className={field}>
            <option value="">Choose approved refund</option>
            {refundApprovals?.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {pesos(entry.amount)} · {entry.reason}
              </option>
            ))}
          </select>
        </label>
      )}
      {payment && (
        <>
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
              {(!refund || !row.unifiedReservationId) && (
                <option value="cash">Cash</option>
              )}
              <option value="gcash">GCash</option>
            </select>
          </label>
          {method === "gcash" && (
            <Text name="reference" label="GCash transaction reference" />
          )}
          {method === "cash" && !refund ? (
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
          ) : (
            <>
              <ManilaDateTimeInput
                name={timeName}
                label={refund ? "Refund transfer time (Manila)" : "GCash transaction time (Manila)"}
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
            <p className="text-sm text-muted">The system records the current Manila time when you save.</p>
          )}
          {refund ? (
            <Text name="evidence" label="Refund verification note" />
          ) : (
            <details>
              <summary className="cursor-pointer text-primary">Add a note (optional)</summary>
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
              ? "I verified the refund was completed."
              : method === "cash"
                ? "I received the cash."
                : "I verified the payment in the hotel’s GCash account."}
          </label>
        </>
      )}
      <div className="flex flex-wrap gap-3">
        <button disabled={disabled || (refund && !refundApprovals?.length)} className={button}>
          {action === "complete" ? "Confirm checkout" : hallActionLabels[action]}
        </button>
        <button type="button" className="min-h-11 px-3 text-primary" onClick={close}>
          Close
        </button>
      </div>
    </form>
  );
}

function HallCardActions({
  row,
  now,
  possibleNoShow,
  disabled,
  action,
  finances,
  openHistory,
  send,
  choose,
  close,
  loadHistory,
}: {
  row: Row;
  now: number;
  possibleNoShow: boolean;
  disabled: boolean;
  action?: HallCardAction;
  finances?: Finances;
  openHistory: boolean;
  send: SendHallAction;
  choose: (action: HallCardAction) => void;
  close: () => void;
  loadHistory: () => void;
}) {
  const onlineInquiry = Boolean(row.unifiedReservationId) && row.status === "inquiry";
  const inquiry = row.status === "inquiry" && !onlineInquiry;
  const confirmed = row.status === "confirmed";
  const inProgress = row.status === "in_progress";
  const completed = row.status === "completed";
  const balance = Number(row.balance);
  const start = row.quote ? Date.parse(row.quote.start) : null;
  const end = row.quote ? Date.parse(row.quote.end) : null;
  const primary: HallCardAction | undefined =
    inquiry ? (row.depositDue === 0 ? "confirm" : "receipt")
    : inProgress ? "complete"
    : (confirmed || completed) && balance > 0 ? "receipt"
    : confirmed ? "start"
    : undefined;
  let actionBlocker = "";
  if (primary === "start") {
    if (start === null || end === null || now < start || now >= end)
      actionBlocker = "Start is available during the scheduled event.";
    else if (!row.ready)
      actionBlocker = "Mark the Hall Ready before starting.";
  }
  if (primary === "confirm" && Date.parse(row.quote_input.start + ":00+08:00") <= now)
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
  if (((confirmed || inProgress) && primary !== "receipt") || latePayment)
    exceptions.push("receipt");
  if (row.status === "no_show" && row.ready && !row.released_at)
    exceptions.push("release");
  if (completed && end !== null && row.actual_end &&
      Date.parse(row.actual_end) > end && Number(row.overtime) === 0)
    exceptions.push("overtime");
  if (!onlineInquiry && Number(row.collected) > 0)
    exceptions.push("approve_refund", "complete_refund");

  return (
    <div className="space-y-3 border-t border-subtle pt-3">
      {inquiry && row.inquiryPrice !== undefined && (
        <p className="text-sm">
          {row.depositDue ? `Deposit still due: ${pesos(row.depositDue)}` : "Deposit met"}
        </p>
      )}
      {primary === "receipt" || primary === "complete" ? (
        action !== primary && (
          <button
            type="button"
            className={button}
            disabled={disabled}
            onClick={() => choose(primary)}
          >
            {primary === "complete"
              ? hallActionLabels.complete
              : inquiry ? "Record payment" : "Collect balance"}
          </button>
        )
      ) : primary && (
        <form onSubmit={(event) => void send(event, "actions/" + primary)}>
          <input type="hidden" name="id" value={row.id} />
          <button className={button} disabled={disabled || Boolean(actionBlocker)}>
            {hallActionLabels[primary]}
          </button>
          {actionBlocker && <p className="mt-1 text-sm text-muted">{actionBlocker}</p>}
        </form>
      )}
      {action && (
        <HallCardActionForm
          key={action}
          row={row}
          action={action}
          finances={finances}
          disabled={disabled}
          send={send}
          close={close}
        />
      )}
      {exceptions.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-primary">More actions</summary>
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
                  ? latePayment ? "Record late payment" : "Record additional payment"
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
        {!finances ? <p>Loading payment history…</p> : (
          <>
            {finances.receipts.length === 0 && <p>No verified payments.</p>}
            {finances.receipts.map((receipt) => (
              <p key={receipt.id}>
                {hotel.format(new Date(receipt.received_at))} · {receipt.method} ·{" "}
                {pesos(receipt.amount)} · {receipt.reference ?? "Cash received"} · {receipt.evidence}
              </p>
            ))}
            {finances.refunds.map((refund) => (
              <p key={refund.id}>
                {pesos(refund.amount)} ·{" "}
                {refund.pending ? "Approved, awaiting manual transfer"
                  : refund.transferred_at ? "Transferred " + hotel.format(new Date(refund.transferred_at))
                  : "No transfer required"}{" "}
                · {refund.reason} {refund.reference}
              </p>
            ))}
          </>
        )}
      </details>
    </div>
  );
}

const settingsLabels: Record<string, string> = {
  horizon: "Booking horizon (calendar days)",
  preparation: "Preparation (minutes)",
  cleanup: "Cleanup (minutes)",
  noShowGrace: "No-show grace (minutes)",
  reminder: "Countdown reminder (minutes before end)",
};

export default function HallDesk({ token }: { token: string }) {
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>();
  const [report, setReport] = useState<Report>();
  const [message, setMessage] = useState("");
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
  const [selected, setSelected] = useState(searchParams.get("item") ?? "");
  const [finances, setFinances] = useState<Record<string, Finances>>({});
  useEffect(() => {
    setEntries([]);
    setHall(undefined);
    setActiveAction(undefined);
    setFinances({});
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
        if (!controller.signal.aborted)
          setFinances((current) => ({ ...current, [selected]: result }));
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Financial history unavailable.");
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
  async function send(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    if (busy) return;
    if (pending && path.startsWith("actions/")) {
      setMessage("Resolve the saved command before recording another action.");
      return;
    }
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const data: Record<string, unknown> = { ...values };
    if (
      [
        "actions/reschedule",
        "actions/extend",
        "actions/recover_inquiry",
      ].includes(path)
    )
      data.expectedClaim = entries.find(
        (entry) => entry.id === data.id,
      )?.claim_id;
    for (const key of [
      "attendees",
      "minutes",
      "hours",
      ...Object.keys(settingsLabels),
    ])
      if (key in data) data[key] = Number(data[key]);
    if (data.receivedAt === "") delete data.receivedAt;
    else if (typeof data.receivedAt === "string") data.receivedAt += ":00+08:00";
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
    const actionLabel =
      path === "actions/ready"
        ? "Confirm the Hall is clean and ready"
        : (hallActionLabels[commandAction] ?? "Record " + path.slice(8).replaceAll("_", " "));
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
        const command = { path, payload, key };
        pendingHallCommand(sessionStorage, token).save(command);
        setPending(command);
      }
      const response = await fetch(
        apiBase +
          "/staff/hall/" +
          (path === "reports"
            ? "reports?" + new URLSearchParams(values as Record<string, string>)
            : path),
        path === "reports"
          ? { headers }
          : {
              method: "POST",
              headers: { ...headers, "Idempotency-Key": key },
              body: payload,
            },
      );
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          setRetry(undefined);
          if (path.startsWith("actions/")) {
            pendingHallCommand(sessionStorage, token).clear();
            setPending(undefined);
          }
        }
        if (result.issue) setRevision((v) => v + 1);
        throw new Error(result.error ?? result.issue ?? "Action unavailable.");
      }
      setRetry(undefined);
      if (path.startsWith("actions/")) {
        pendingHallCommand(sessionStorage, token).clear();
        setPending(undefined);
      }
      if (path === "reports") setReport(result);
      else if (path === "quote")
        setMessage(
          pesos(result.total) +
            (result.available
              ? " · Available when checked"
              : " · Protected interval unavailable"),
        );
      else {
        setMessage(
          path === "actions/receipt" ? "Payment recorded."
            : path === "actions/confirm" ? "Booking confirmed."
            : path === "actions/start" ? "Event started."
            : path === "actions/complete" ? "Guest checked out. Mark the hall ready after cleaning."
            : path === "actions/ready" ? "Hall marked Ready."
            : "Action recorded.",
        );
        if (typeof data.id === "string") setSelected(data.id);
        setActiveAction(undefined);
        notifySuccess("Function Hall action recorded.");
        setRevision((v) => v + 1);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Action unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recoverCommand(replay: boolean) {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        apiBase +
          "/staff/hall/" +
          (replay ? pending.path : "commands/" + pending.key),
        {
          method: replay ? "POST" : "GET",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            "Idempotency-Key": pending.key,
          },
          ...(replay ? { body: pending.payload } : {}),
        },
      );
      const result = await response.json();
      if (!response.ok && !(response.status === 409 && result.issue))
        throw new Error(
          result.error ??
            "Recovery unavailable. Keep the saved command for retry.",
        );
      pendingHallCommand(sessionStorage, token).clear();
      setPending(undefined);
      setRetry(undefined);
      setMessage(
        result.issue ??
          result.result?.issue ??
          "Saved command recovered. Review the updated reservation.",
      );
      if (!result.issue && !result.result?.issue)
        notifySuccess("Saved Function Hall command recovered.");
      setRevision((v) => v + 1);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Recovery unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 space-y-5">
      <h2 className="text-2xl font-semibold">Function Hall</h2>
      {pending && (
        <section
          aria-label="Saved Hall command"
          className="rounded border border-subtle p-3"
        >
          <p>
            A previous {pending.path.slice(8).replaceAll("_", " ")} may have
            committed. Recover its result before entering another transaction.
          </p>
          <button
            disabled={busy}
            className={button}
            onClick={() => void recoverCommand(false)}
          >
            Check saved result
          </button>{" "}
          <button
            disabled={busy}
            className={button}
            onClick={() => void recoverCommand(true)}
          >
            Retry original command
          </button>
        </section>
      )}
      <nav
        aria-label="Function Hall"
        className="flex flex-wrap gap-4 text-primary"
      >
        {[
          ["calendar", "Calendar"],
          ["new", "New inquiry"],
          ["settings", "Settings"],
          ["reports", "Reports"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setMessage("");
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
        <>
          <form
            className="space-y-3"
            onSubmit={(event) => void send(event, "actions/inquiry")}
          >
            <label>
              Channel
              <select name="channel" className={field}>
                <option value="walk_in">Walk-in</option>
                <option value="telephone">Telephone</option>
                <option value="messenger">Facebook Messenger</option>
              </select>
            </label>
            <Text name="organizer" label="Organizer" />
            <Text
              name="requests"
              label="Additional requests (manual follow-up)"
              required={false}
            />
            <Schedule />
            <button disabled={busy} className={button}>
              Record inquiry
            </button>
          </form>
          <details>
            <summary>Check a quote and availability</summary>
            <form
              className="space-y-3"
              onSubmit={(event) => void send(event, "quote")}
            >
              <Schedule />
              <button disabled={busy} className={button}>
                Check quote
              </button>
            </form>
          </details>
        </>
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
            <section className="space-y-3 rounded-xl border border-subtle p-4" aria-label="Hall readiness">
              <p className="font-semibold">
                Hall readiness · {hall.occupied ? "Occupied" : hall.ready ? "Ready" : "Not ready"}
              </p>
              {!hall.ready && !hall.occupied && (
                <form
                  className="flex flex-wrap items-end gap-3"
                  onSubmit={(event) => void send(event, "actions/ready")}
                >
                  <input type="hidden" name="reason" value="Staff confirmed the Hall is clean and ready." />
                  <button disabled={busy || !!pending} className={button}>
                    Mark Hall Ready
                  </button>
                </form>
              )}
            </section>
          )}
          {!settings && !message && <p role="status">Loading calendar…</p>}
          {settings && entries.length === 0 && (
            <p className="staff-empty">No reservations on this page.</p>
          )}
          {["In progress", "Upcoming and inquiries", "Past events"].map((group) => {
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
                    const remainingSeconds = Math.max(0, Math.ceil((remainingMs ?? 0) / 1000));
                    const price = row.inquiryPrice ?? (BigInt(row.total) + BigInt(row.overtime));
                    const balance = row.inquiryPrice === undefined
                      ? row.balance
                      : Math.max(0, row.inquiryPrice - Number(row.collected) + Number(row.refunded));
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
                        {row.unifiedReservationId && row.status === "inquiry" && (
                          row.onlineState === "proof_pending_review" ? (
                            <Link className={button + " inline-flex items-center"} to="/staff/payments">
                              Verify payment
                            </Link>
                          ) : (
                            <p className="text-sm text-muted">
                              {row.onlineState === "expired"
                                ? "Online payment hold expired."
                                : "Waiting for the guest to submit GCash payment proof."}
                            </p>
                          )
                        )}
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
                                  {hotel.format(new Date(request.recorded_at))}
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
                                    Duration: {request.input.minutes / 60} hours
                                  </p>
                                )}
                                {request.input.hours !== undefined && (
                                  <p>Additional hours: {request.input.hours}</p>
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
                          Price {pesos(String(price))} · Paid {pesos(row.collected)} ·
                          Balance {pesos(balance)}
                          {Number(row.refunded) > 0 && <> · Refunded {pesos(row.refunded)}</>}
                        </p>

                        {row.requests && (
                          <p className="break-words">Requests: {row.requests}</p>
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
                        {row.status === "in_progress" && remainingMs !== null && (
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
                                : remainingMs <= (settings?.reminder ?? 15) * 60000
                                  ? "Time remaining · Ending soon"
                                  : "Time remaining"}
                            </p>
                            <p role="timer" aria-label="Time remaining" className="text-3xl font-semibold tabular-nums">
                              {[
                                Math.floor(remainingSeconds / 3600),
                                Math.floor(remainingSeconds / 60) % 60,
                                remainingSeconds % 60,
                              ].map((part) => String(part).padStart(2, "0")).join(":")}
                            </p>
                          </div>
                        )}
                        {row.status === "completed" && row.actual_end && (
                          <p className="text-sm">Checked out {hotel.format(new Date(row.actual_end))}</p>
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
                          now={now}
                          possibleNoShow={possibleNoShow}
                          disabled={busy || !!pending}
                          action={activeAction?.id === row.id ? activeAction.action : undefined}
                          finances={finances[row.id]}
                          openHistory={searchParams.get("item") === row.id}
                          send={send}
                          choose={(action) => {
                            if (action === "complete_refund") setSelected(row.id);
                            setActiveAction({ id: row.id, action });
                          }}
                          close={() => setActiveAction(undefined)}
                          loadHistory={() => setSelected(row.id)}
                        />
                      </article>
                    );
                  })}
                </section>
              )
            );
          })}
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
      {tab === "reports" && (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => void send(event, "reports")}
          >
            <Text name="from" label="From (Manila)" type="date" />
            <Text name="to" label="Through (Manila)" type="date" />
            <button disabled={busy} className={button}>
              View report
            </button>
          </form>
          {report && (
            <section aria-label="Hall report" className="space-y-3">
              <p>
                Gross collections {pesos(report.gross)} · Completed refunds{" "}
                {pesos(report.refunds)} · Net Collections {pesos(report.net)}
              </p>
              <p>
                {report.utilization.bookings} bookings ·{" "}
                {report.utilization.scheduled_minutes} scheduled event minutes ·{" "}
                {report.utilization.actual_minutes} actual occupied minutes ·{" "}
                {report.utilization.preparation_minutes} setup minutes ·{" "}
                {report.utilization.cleanup_minutes} cleanup minutes
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {["Manila day", "Gross", "Refunds", "Net"].map(
                        (label) => (
                          <th key={label} scope="col">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.map((day) => (
                      <tr key={day.day}>
                        <th scope="row">{day.day}</th>
                        <td>{pesos(day.gross)}</td>
                        <td>{pesos(day.refunds)}</td>
                        <td>{pesos(day.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
