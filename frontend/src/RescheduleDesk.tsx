import { useEffect, useRef, useState } from "react";
import type { RescheduleInput, RescheduleRecord } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { hotelTime, peso } from "./BookingPlanner";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white p-2 text-base";
const button =
  "min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50";
const stamp = (date: string, hour: string, minute: string, period: string) =>
  `${date}T${String((Number(hour) % 12) + (period === "PM" ? 12 : 0)).padStart(2, "0")}:${minute}:00+08:00`;

export function GuestRescheduleForm({
  itemId,
  revision,
  startAt,
  endAt,
  blocks,
  confirmationAt,
  submit,
  refresh,
}: {
  itemId: string;
  revision: number;
  startAt: string;
  endAt: string;
  blocks: number[];
  confirmationAt: string | null;
  submit: (input: RescheduleInput) => Promise<RescheduleRecord>;
  refresh?: () => Promise<{
    revision: number;
    startAt: string;
    endAt: string;
    confirmationAt: string | null;
    pending: boolean;
  }>;
}) {
  const [snapshot, setSnapshot] = useState({
    revision,
    startAt,
    endAt,
    confirmationAt,
  });
  const recorded = useRef(false);
  const local = new Date(Date.parse(startAt) + 8 * 3600000).toISOString();
  const [date, setDate] = useState(local.slice(0, 10));
  const [hour, setHour] = useState(
    String(Number(local.slice(11, 13)) % 12 || 12),
  );
  const [minute, setMinute] = useState(local.slice(14, 16));
  const [period, setPeriod] = useState(
    Number(local.slice(11, 13)) >= 12 ? "PM" : "AM",
  );
  const [packages, setPackages] = useState(blocks.join(","));
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const retry = useRef(crypto.randomUUID());
  return (
    <form
      className="my-3 space-y-3 rounded-xl border border-subtle p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy || stale) return;
        setBusy(true);
        setMessage("");
        try {
          const selected = packages.split(",").map((x) => Number(x.trim()));
          if (
            !selected.length ||
            selected.length > 30 ||
            selected.some((x) => ![180, 360, 720, 1440].includes(x))
          )
            throw Object.assign(
              new Error("Use allowed package minutes: 180, 360, 720 or 1440."),
              { status: 400 },
            );
          const start = stamp(date, hour, minute, period);
          const end = new Date(
            Date.parse(start) + selected.reduce((a, b) => a + b, 0) * 60000,
          ).toISOString();
          await submit({
            requestKey: retry.current,
            expectedRevision: snapshot.revision,
            startAt: start,
            endAt: end,
            blocks: selected,
            reason,
          });
          recorded.current = true;
          notifySuccess("Schedule change requested. Your original schedule stays active until approved.");
          setMessage(
            "Request recorded. Your original schedule remains active until staff approves.",
          );
          setStale(true);
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Request unavailable. Refresh and review.",
          );
          setStale((error as { status?: number }).status !== 400);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="font-semibold">Request a schedule change</p>
      <p>
        {hotelTime(startAt)} → {hotelTime(endAt)}
      </p>
      <p className="text-sm text-muted">
        Original cancellation deadline:{" "}
        {snapshot.confirmationAt
          ? hotelTime(
              new Date(
                Date.parse(snapshot.confirmationAt) + 3600000,
              ).toISOString(),
            )
          : "Not applicable"}
        . Rescheduling does not restart it.
      </p>
      <div className="grid gap-3 sm:grid-cols-4">
        <label>
          Arrival date
          <input
            aria-label={`Arrival date - ${itemId}`}
            type="date"
            required
            className={field}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label>
          Hour
          <select
            aria-label={`Arrival hour - ${itemId}`}
            className={field}
            value={hour}
            onChange={(e) => setHour(e.target.value)}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1}>{i + 1}</option>
            ))}
          </select>
        </label>
        <label>
          Minute
          <select
            aria-label={`Arrival minute - ${itemId}`}
            className={field}
            value={minute}
            onChange={(e) => setMinute(e.target.value)}
          >
            {Array.from({ length: 60 }, (_, i) => (
              <option key={i}>{String(i).padStart(2, "0")}</option>
            ))}
          </select>
        </label>
        <label>
          AM/PM
          <select
            aria-label={`Arrival period - ${itemId}`}
            className={field}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option>AM</option>
            <option>PM</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-muted">
        Asia/Manila. Keeping purchased packages preserves their booked price.
        Proposed capacity is not reserved.
      </p>
      <label className="block">
        Package minutes (comma-separated)
        <input
          aria-label={`Package minutes - ${itemId}`}
          className={field}
          required
          value={packages}
          onChange={(e) => setPackages(e.target.value)}
        />
      </label>
      <p className="text-sm text-muted">
        Changing duration creates a policy-pending quote only; no schedule,
        charge or refund is approved.
      </p>
      <label className="block">
        Request reason
        <textarea
          aria-label={`Request reason - ${itemId}`}
          className={field}
          required
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className={button}
        disabled={busy || stale}
        aria-label={`Request reschedule - ${itemId}`}
      >
        {busy ? "Submitting…" : "Request reschedule"}
      </button>
      {message && <p role="alert">{message}</p>}
      {stale && (
        <p>
          <button
            type="button"
            className="min-h-11 font-semibold text-primary"
            aria-label={`Refresh reservation - ${itemId}`}
            disabled={busy || !refresh}
            onClick={async () => {
              if (!refresh) return;
              setBusy(true);
              try {
                const current = await refresh();
                setSnapshot(current);
                setStale(current.pending);
                if (recorded.current && !current.pending) {
                  retry.current = crypto.randomUUID();
                  recorded.current = false;
                }
                setMessage(
                  current.pending
                    ? "A request is already pending. Your drafts are retained."
                    : "Reservation refreshed. Your drafts are retained; review before submitting.",
                );
              } catch (e) {
                setMessage(
                  e instanceof Error ? e.message : "Refresh unavailable",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Refresh reservation and review again
          </button>
        </p>
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
  endAt: string;
  blocks: number[];
  confirmationAt: string | null;
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
          endAt: item.endAt,
          confirmationAt: item.confirmationAt,
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
      <h3 className="font-semibold break-all">{row.id}</h3>
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
      <p>
        Purchased packages: {row.originalBlocks.join(" + ")} minutes. Requested
        packages: {row.blocks.join(" + ")} minutes.
      </p>
      <p className="mt-3">Purchased price: {peso(row.originalCentavos)}</p>
      <p className="text-sm text-muted">
        Original cancellation deadline:{" "}
        {row.cancellationDeadlineAt
          ? hotelTime(row.cancellationDeadlineAt)
          : "Not applicable"}
      </p>
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
            : (row.blocker ?? row.eligibility.replaceAll("_", " "))}
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
      <h2 className="text-2xl font-bold">Rescheduling</h2>
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
                ? (row.blocker ?? row.eligibility.replaceAll("_", " "))
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
