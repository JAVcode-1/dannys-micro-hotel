import {
  hours,
  minutes,
  TimePickerChevron,
  timePickerButton,
  timePickerInputPadding,
} from "./TimePartInput";
import { readableLabel } from "./presentation";
import { useEffect, useRef, useState } from "react";
import type { RescheduleInput, RescheduleRecord } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { hotelTime, peso } from "./BookingPlanner";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white p-2 text-base";
const button =
  "min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50";
const manilaOffsetMs = 8 * 60 * 60 * 1000;
const arrivalTimePattern = /^(0?[1-9]|1[0-2]):([0-5][0-9])$/;
const invalidField = " ring-1 ring-red-600";

export function GuestRescheduleForm({
  itemId,
  revision,
  startAt,
  blocks,
  submit,
  refresh,
}: {
  itemId: string;
  revision: number;
  startAt: string;
  blocks: number[];
  submit: (input: RescheduleInput) => Promise<RescheduleRecord>;
  refresh?: () => Promise<{
    revision: number;
    startAt: string;
    pending: boolean;
  }>;
}) {
  const [snapshot, setSnapshot] = useState({ revision, startAt });
  const local = new Date(Date.parse(startAt) + manilaOffsetMs).toISOString();
  const localHour = Number(local.slice(11, 13));
  const [date, setDate] = useState(local.slice(0, 10));
  const [time, setTime] = useState(
    `${localHour % 12 || 12}:${local.slice(14, 16)}`,
  );
  const [period, setPeriod] = useState(localHour >= 12 ? "PM" : "AM");
  const [note, setNote] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [pending, setPending] = useState(false);
  const retry = useRef(crypto.randomUUID());

  const now = Date.now();
  const today = new Date(now + manilaOffsetMs).toISOString().slice(0, 10);
  const match = arrivalTimePattern.exec(time.trim());
  const requestedStart = match && date
    ? `${date}T${String((Number(match[1]) % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${match[2]}:00+08:00`
    : "";
  const arrivalMs = Date.parse(requestedStart);
  const durationMinutes = blocks.reduce((sum, block) => sum + block, 0);
  const dateError = date && date < today
    ? "Choose today or a later date."
    : attempted && !date
      ? "Choose an arrival date."
      : "";
  const timeError =
    attempted && !match
      ? "Enter a time such as 2:30."
      : !dateError && Number.isFinite(arrivalMs) && arrivalMs <= now
        ? "Choose an arrival time in the future."
        : "";
  const changed = arrivalMs !== Date.parse(snapshot.startAt);
  const checkout =
    changed && Number.isFinite(arrivalMs) && arrivalMs > now
      ? new Date(arrivalMs + durationMinutes * 60000).toISOString()
      : null;

  if (pending) {
    return (
      <div role="status" className="my-3 rounded-xl border border-subtle bg-selected p-4">
        <p className="font-semibold">Awaiting staff approval</p>
        <p className="mt-1">
          Your current booking stays active while staff check availability.
        </p>
      </div>
    );
  }

  const dateErrorId = `arrival-date-error-${itemId}`;
  const timeErrorId = `arrival-time-error-${itemId}`;

  return (
    <form
      className="my-3 space-y-3 rounded-xl border border-subtle p-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || stale) return;
        setAttempted(true);
        setMessage("");
        if (!date || !match || dateError || timeError) return;
        if (!Number.isFinite(arrivalMs) || arrivalMs <= Date.now()) {
          setMessage("Choose a future arrival date and time.");
          return;
        }
        if (!checkout) {
          setMessage("Choose a different arrival date or time.");
          return;
        }
        setBusy(true);
        try {
          await submit({
            requestKey: retry.current,
            expectedRevision: snapshot.revision,
            startAt: requestedStart,
            endAt: checkout,
            blocks,
            reason: note.trim() || "Guest requested a new arrival date or time.",
          });
          setPending(true);
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Could not send the request. Refresh your booking and try again.",
          );
          setStale((error as { status?: number }).status !== 400);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-semibold">Request a new arrival</p>
      <div className="grid gap-3 sm:grid-cols-[2fr_2fr_1fr]">
        <div>
          <label>
            Arrival date
            <input
              aria-label={`Arrival date - ${itemId}`}
              aria-invalid={Boolean(dateError)}
              aria-describedby={dateError ? dateErrorId : undefined}
              type="date"
              min={today}
              required
              className={field + (dateError ? invalidField : "")}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          {dateError && <p id={dateErrorId} className="text-red-700">{dateError}</p>}
        </div>
        <div>
          <div className="relative grid min-w-0">
            <label htmlFor={`arrival-time-${itemId}`}>Arrival time</label>
            <input
              id={`arrival-time-${itemId}`}
              style={timePickerInputPadding}
              aria-label={`Arrival time - ${itemId}`}
              aria-invalid={Boolean(timeError)}
              aria-describedby={timeError ? timeErrorId : undefined}
              placeholder="2:30"
              required
              className={field + (timeError ? invalidField : "")}
              value={time}
              onChange={(event) => setTime(event.target.value)}
            />
            <details>
              <summary
                aria-label="Choose hour and minute"
                className={
                  timePickerButton + " list-none [&::-webkit-details-marker]:hidden"
                }
              >
                <TimePickerChevron />
              </summary>
              <div className="absolute right-0 top-full z-20 mt-2 grid w-56 grid-cols-2 gap-3 rounded-xl border border-subtle bg-white p-3 text-sm shadow-lg">
                <label>
                  Hour
                  <select
                    aria-label={`Choose arrival hour - ${itemId}`}
                    className={field}
                    value={match ? String(Number(match[1])) : ""}
                    onChange={(event) => setTime(`${event.target.value}:${match?.[2] ?? "00"}`)}
                  >
                    <option value="" disabled>Hour</option>
                    {hours.map((hour) => <option key={hour}>{hour}</option>)}
                  </select>
                </label>
                <label>
                  Minute
                  <select
                    aria-label={`Choose arrival minute - ${itemId}`}
                    className={field}
                    value={match?.[2] ?? ""}
                    onChange={(event) => setTime(`${match?.[1] ?? (localHour % 12 || 12)}:${event.target.value}`)}
                  >
                    <option value="" disabled>Minute</option>
                    {minutes.map((minute) => <option key={minute}>{minute}</option>)}
                  </select>
                </label>
              </div>
            </details>
          </div>
          {timeError && <p id={timeErrorId} className="text-red-700">{timeError}</p>}
        </div>
        <label>
          AM/PM
          <select
            aria-label={`Arrival period - ${itemId}`}
            className={field}
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </label>
      </div>
      {checkout && (
        <p className="rounded-lg bg-selected p-3 text-sm" aria-live="polite">
          <strong>New checkout:</strong> {hotelTime(checkout)}
        </p>
      )}
      <p className="text-sm text-muted">
        Times are in Manila time. Your {durationMinutes / 60}-hour stay and
        booked price stay the same. Contact the hotel for a different stay length.
      </p>
      <label className="block">
        Note for staff (optional)
        <input
          aria-label={`Note for staff - ${itemId}`}
          className={field}
          maxLength={1000}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <button
        className={button}
        disabled={busy || stale}
        aria-label={`Send request - ${itemId}`}
      >
        {busy ? "Sending…" : "Send request"}
      </button>
      {message && <p role="alert">{message}</p>}
      {stale && refresh && (
        <button
          type="button"
          className="min-h-11 font-semibold text-primary"
          aria-label={`Refresh reservation - ${itemId}`}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const current = await refresh();
              setSnapshot(current);
              setPending(current.pending);
              if (!current.pending) retry.current = crypto.randomUUID();
              setStale(false);
              setMessage("Booking refreshed. Review your new arrival before sending.");
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Refresh unavailable",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Refresh and review
        </button>
      )}
    </form>
  );
}

async function api(path: string, token: string, body?: unknown) {
  const response = await fetch(`${apiBase}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(result.error ?? "Rescheduling unavailable"), {
      status: response.status,
    });
  return result;
}
export function GuestRescheduleRequest(props: {
  token: string;
  itemId: string;
  revision: number;
  startAt: string;
  blocks: number[];
}) {
  return (
    <GuestRescheduleForm
      {...props}
      submit={(input) =>
        api(`/guest/reschedules/${props.itemId}`, props.token, input)
      }
      refresh={async () => {
        const rows = await api("/guest/reservations", props.token);
        const item = rows
          .flatMap((r: { items: unknown[] }) => r.items)
          .find((i: { id: string }) => i.id === props.itemId);
        if (!item) throw new Error("Room item unavailable");
        return {
          revision: item.scheduleRevision ?? 0,
          startAt: item.startAt,
          pending: item.pendingReschedule ?? false,
        };
      }}
    />
  );
}
function fixtures(): RescheduleRecord[] {
  const start = Date.UTC(2027, 0, 2, 2);
  return ["A", "B"].map((label, i) => ({
    id: `Synthetic item ${label}`,
    roomBookingId: `Synthetic room item ${label}`,
    expectedRevision: 0,
    originalStartAt: new Date(start + i * 86400000).toISOString(),
    originalEndAt: new Date(start + i * 86400000 + 21600000).toISOString(),
    requestedStartAt: new Date(start + (i + 5) * 86400000).toISOString(),
    requestedEndAt: new Date(
      start + (i + 5) * 86400000 + 21600000,
    ).toISOString(),
    eligibility: i ? "financial_policy_pending" : "eligible",
    approved: null,
    originalCentavos: 40000,
    proposalDeltaCentavos: i ? -20000 : null,
    proposalStatus: i ? "policy_pending" : null,
    confirmationAt: "2026-11-19T02:00:00Z",
    cancellationDeadlineAt: "2026-11-19T03:00:00Z",
    currentStartAt: new Date(start + i * 86400000).toISOString(),
    currentEndAt: new Date(start + i * 86400000 + 21600000).toISOString(),
    currentRevision: 0,
    blocks: i ? [180] : [360],
    originalBlocks: [360],
    reason: "Synthetic guest requested a new arrival",
    blocker: i ? "Financial policy pending" : null,
    canApprove: i === 0,
  }));
}
export function ReschedulePreview() {
  return <RescheduleDesk />;
}
function DecisionCard({
  row,
  enabled,
  decide,
  refreshVersion,
}: {
  refreshVersion: number;
  row: RescheduleRecord;
  enabled: boolean;
  decide: (approved: boolean, reason: string, key: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    setStale(false);
    setMessage("");
  }, [refreshVersion]);
  const retry = useRef(crypto.randomUUID());
  const dialog = useRef<HTMLDialogElement>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (confirm !== null) {
      if (dialog.current?.showModal) dialog.current.showModal();
      else dialog.current?.setAttribute("open", "");
    }
  }, [confirm]);
  const close = () => {
    dialog.current?.close?.();
    setConfirm(null);
    origin.current?.focus();
  };
  return (
    <article className="mt-4 rounded-xl border border-subtle bg-white p-5">
      <h3 className="font-semibold">
        Schedule request {row.id.slice(0, 8).toUpperCase()}
      </h3>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer text-muted">
          Request reference
        </summary>
        <p className="break-all">{row.id}</p>
      </details>
      <dl className="mt-3 space-y-2 text-sm">
        <div>
          <dt className="text-muted">Current schedule</dt>
          <dd>
            {hotelTime(row.originalStartAt)} → {hotelTime(row.originalEndAt)}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Requested</dt>
          <dd>
            {hotelTime(row.requestedStartAt)} → {hotelTime(row.requestedEndAt)}
          </dd>
        </div>
      </dl>
      <p className="mt-3 break-words">Guest reason: {row.reason}</p>
      <details className="mt-3 text-sm">
        <summary className="min-h-11 cursor-pointer text-primary">
          Packages and policy records
        </summary>
        <p>
          Purchased packages: {row.originalBlocks.join(" + ")} minutes.
          Requested packages: {row.blocks.join(" + ")} minutes.
        </p>
        <p className="mt-3">Purchased price: {peso(row.originalCentavos)}</p>
        <p className="text-sm text-muted">
          Original cancellation deadline:{" "}
          {row.cancellationDeadlineAt
            ? hotelTime(row.cancellationDeadlineAt)
            : "Not applicable"}
        </p>
      </details>
      {row.proposalStatus && (
        <p className="mt-3 rounded-lg bg-lavender p-3">
          Proposal only: {peso(row.proposalDeltaCentavos ?? 0)} — policy
          pending. No charge or refund posted.
        </p>
      )}
      <p className="mt-3" role="status">
        {row.approved === true
          ? "Approved schedule move"
          : row.approved === false
            ? "Request rejected"
            : (row.blocker ?? readableLabel(row.eligibility))}
      </p>
      {row.approved === null && (
        <>
          <label className="mt-3 block">
            Decision reason
            <textarea
              aria-label={`Decision reason - ${row.id}`}
              className={field}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            {[true, false].map((approve) => (
              <button
                key={String(approve)}
                aria-label={`${approve ? "Approve" : "Reject"} - ${row.id}`}
                className={button}
                disabled={
                  !enabled ||
                  busy ||
                  stale ||
                  !reason.trim() ||
                  (approve && !row.canApprove)
                }
                onClick={(e) => {
                  origin.current = e.currentTarget;
                  setConfirm(approve);
                }}
              >
                {approve ? "Approve" : "Reject"}
              </button>
            ))}
          </div>
        </>
      )}
      {message && <p role="alert">{message}</p>}
      {confirm !== null && (
        <dialog
          ref={dialog}
          role="dialog"
          aria-modal="true"
          aria-label="Confirm rescheduling decision"
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          className="max-w-lg rounded-xl border border-subtle bg-white p-6 text-main shadow-xl"
        >
          <h4 className="text-lg font-bold">
            {confirm ? "Approve this schedule move?" : "Reject this request?"}
          </h4>
          <p className="my-3">
            {hotelTime(row.originalStartAt)} → {hotelTime(row.requestedStartAt)}
            . Purchased price {peso(row.originalCentavos)}. Original
            cancellation deadline unchanged.
          </p>
          <p>
            Requested end: {hotelTime(row.requestedEndAt)}. Original
            cancellation deadline:{" "}
            {row.cancellationDeadlineAt
              ? hotelTime(row.cancellationDeadlineAt)
              : "Not applicable"}
            . Packages: {row.blocks.join(" + ")} minutes.
          </p>
          <p className="break-words">Reason: {reason}</p>
          <button
            className={`${button} mt-4`}
            disabled={busy}
            onClick={async () => {
              if (busy) return;
              setBusy(true);
              try {
                await decide(confirm, reason, retry.current);
                notifySuccess("Reschedule decision recorded.");
                close();
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Decision unavailable",
                );
                setStale(true);
                close();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirm ? "Confirm approval" : "Confirm rejection"}
          </button>
          <button
            className="ml-4 min-h-11 text-primary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
        </dialog>
      )}
    </article>
  );
}
export default function RescheduleDesk({
  token,
  guest = false,
}: {
  token?: string;
  guest?: boolean;
}) {
  const [rows, setRows] = useState<RescheduleRecord[]>(token ? [] : fixtures);
  const [enabled, setEnabled] = useState(!token);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!token) return;
    let active = true;
    setEnabled(false);
    void api(`/${guest ? "guest" : "staff"}/reschedules?page=${page}`, token)
      .then((data) => {
        if (active) {
          setRows(data.items);
          setEnabled(data.enabled);
          setMessage("");
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [token, guest, page, refresh]);
  return (
    <section aria-label="Rescheduling" className="mt-6 text-main">
      <h2 className="text-2xl font-bold">Schedule changes</h2>
      <p className="mt-2 text-sm text-muted">
        {token
          ? "Staff approval is required. Your original schedule stays active during review."
          : "Synthetic preview — no hotel data, payment or capacity writes."}
      </p>
      {!enabled && (
        <p className="mt-3">Live rescheduling is closed pending acceptance.</p>
      )}
      {message && <p role="alert">{message}</p>}
      <button
        className="mt-3 min-h-11 font-semibold text-primary"
        onClick={() => setRefresh((x) => x + 1)}
      >
        Refresh requests
      </button>
      {rows.map((row) =>
        guest ? (
          <article
            key={row.id}
            className="mt-4 rounded-xl border border-subtle p-4"
          >
            <p>
              {hotelTime(row.requestedStartAt)} →{" "}
              {hotelTime(row.requestedEndAt)}
            </p>
            <p>
              {row.approved === null
                ? (row.blocker ?? readableLabel(row.eligibility))
                : row.approved
                  ? "Approved schedule move"
                  : "Request rejected"}
            </p>
            {row.proposalStatus && (
              <p>
                Policy-pending proposal only:{" "}
                {peso(row.proposalDeltaCentavos ?? 0)}. No charge or refund
                posted.
              </p>
            )}
          </article>
        ) : (
          <DecisionCard
            key={row.id}
            refreshVersion={refresh}
            row={row}
            enabled={enabled}
            decide={async (approved, reason, key) => {
              if (token)
                await api(`/staff/reschedules/${row.id}/decision`, token, {
                  approved,
                  reason,
                  requestKey: key,
                  expectedRevision: row.expectedRevision,
                });
              setRows((prior) =>
                prior.map((r) => (r.id === row.id ? { ...r, approved } : r)),
              );
            }}
          />
        ),
      )}
      {token && (
        <div className="mt-4 flex gap-4">
          <button
            className={button}
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous page
          </button>
          <button
            className={button}
            disabled={rows.length < 100}
            onClick={() => setPage((p) => p + 1)}
          >
            Next page
          </button>
        </div>
      )}
    </section>
  );
}
