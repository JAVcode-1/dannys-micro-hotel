import { useApiQuery, writeApi } from "./api-query";
import { readableLabel } from "./presentation";
import ManilaDateTimeInput from "./ManilaDateTimeInput";
import { useEffect, useRef, useState } from "react";
import type { CancellationRow } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { hotelTime, peso } from "./BookingPlanner";
import { parsePesoInput } from "./peso-input";
import { StaffRefundIssue, StaffRefundIssueQueue } from "./RefundIssue";
import StaffLoadingSkeleton, { SkeletonBlock } from "./StaffLoadingSkeleton";
const button = "rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50";
type PayerForm = {
  name: string;
  account: string;
  note: string;
  ledger: boolean;
  matched: boolean;
};
type TransferForm = {
  amount: string;
  reference: string;
  time: string;
  checked: boolean;
};
const emptyPayer: PayerForm = {
  name: "",
  account: "",
  note: "",
  ledger: false,
  matched: false,
};
const emptyTransfer: TransferForm = {
  amount: "",
  reference: "",
  time: "",
  checked: false,
};
function refundAmounts(row: CancellationRow) {
  const approved = row.refundCentavos ?? 0;
  const refunded =
    row.refundedCentavos ?? (row.refundStatus === "recorded" ? approved : 0);
  return {
    refunded,
    remaining: row.remainingRefundCentavos ?? approved - refunded,
  };
}
const demoKey = "staytrack-x01-preview";
function fixtures(): CancellationRow[] {
  const now = Date.now();
  return ["A", "B", "C"].map((label, index) => ({
    id: `Synthetic item ${label}`,
    reservationId:
      index < 2
        ? "Synthetic shared reservation"
        : "Synthetic walk-in reservation",
    channel: index < 2 ? "online" : "walk_in",
    category: "double_standard",
    startAt: new Date(now + (index + 1) * 86400000).toISOString(),
    endAt: new Date(now + (index + 1) * 86400000 + 10800000).toISOString(),
    originalCentavos: 20000,
    requestedAt: "",
    confirmationAt: index < 2 ? new Date(now - 40 * 60000).toISOString() : null,
    eligibility: "not_requested",
    approved: null,
    refundCentavos: null,
    refundedCentavos: 0,
    remainingRefundCentavos: 0,
    decisionReason: null,
    refundStatus: "not_due",
    paymentId: "Synthetic verified payment",
    claimedBy: null,
    payerName: null,
    payerAccount: null,
    verifiedAt: null,
    transferReference: null,
    transferredAt: null,
    transferHistory: [],
    balanceCentavos: 0,
    refundDueCentavos: 0,
    netChargeCentavos: index < 2 ? 40000 : 20000,
  }));
}
export default function CancellationDesk({
  token,
  guest = false,
}: {
  token?: string;
  guest?: boolean;
}) {
  const [demoRows, setRows] = useState<CancellationRow[]>(() => {
    if (token) return [];
    try {
      return (
        JSON.parse(sessionStorage.getItem(demoKey) ?? "null") ?? fixtures()
      );
    } catch {
      return fixtures();
    }
  });
  const [page, setPage] = useState(0);
  const [actionMessage, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    action: "approve" | "reject" | "claim" | "transfer";
  } | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [payerForms, setPayerForms] = useState<Record<string, PayerForm>>({});
  const [transferForms, setTransferForms] = useState<
    Record<string, TransferForm>
  >({});
  const [requestId, setRequestId] = useState("");
  const attempts = useRef(new Map<string, { key: string; body: string }>());
  const base = guest ? "/guest/cancellations" : "/staff/cancellations";
  const history = useApiQuery<{
    items: CancellationRow[];
    enabled: boolean;
    actorId?: string;
  }>(token ? base + "?page=" + page : null, token, { live: true });
  const rows = token ? (history.data?.items ?? []) : demoRows;
  const actor = token ? (history.data?.actorId ?? "") : "Synthetic staff";
  const enabled =
    !token || (history.data?.enabled === true && !history.isError);
  const historyStatus = history.isError
    ? "error"
    : history.isPending
      ? "loading"
      : "ready";
  const message =
    actionMessage ||
    (history.isError
      ? "Cancellation history unavailable. Approved migration and acceptance are required."
      : "");
  const load = () => history.refetch({ cancelRefetch: false });
  useEffect(() => {
    if (!token) sessionStorage.setItem(demoKey, JSON.stringify(demoRows));
  }, [demoRows, token]);
  async function submit(
    row: CancellationRow,
    action: "request" | "approve" | "reject" | "claim" | "transfer",
    confirmed = false,
  ) {
    if (action !== "request" && !confirmed) {
      setConfirmation({ id: row.id, action });
      return;
    }
    setConfirmation(null);
    setBusy(true);
    setMessage("");
    try {
      const payer = payerForms[row.id] ?? emptyPayer;
      const transfer = transferForms[row.id] ?? emptyTransfer;
      const reason = (reasons[row.id] ?? "").trim();
      let transferCentavos = 0;
      let body: Record<string, unknown> = { reason };
      let path = `${base}/${row.id}/request`;
      if (action === "approve" || action === "reject") {
        if (!reason) throw new Error("Enter a decision reason.");
        body = { approved: action === "approve", reason };
        path = `${base}/${row.id}/decision`;
      }
      if (action === "claim") {
        if (
          !payer.name.trim() ||
          !payer.account.trim() ||
          !payer.note.trim() ||
          !payer.ledger ||
          !payer.matched
        )
          throw new Error(
            "Verify the original payer using the actual receiving ledger.",
          );
        body = {
          action: "claim",
          originalPaymentId: row.paymentId,
          payerName: payer.name,
          payerAccount: payer.account,
          verificationNote: payer.note,
          ledgerChecked: payer.ledger,
          originalPayerMatched: payer.matched,
        };
        path = `${base}/${row.id}/refund`;
      }
      if (action === "transfer") {
        transferCentavos = parsePesoInput(transfer.amount);
        if (transferCentavos <= 0)
          throw new Error("Enter the amount actually sent.");
        if (!transfer.reference.trim() || !transfer.time || !transfer.checked)
          throw new Error(
            "Verify the actual manual transfer and enter its reference and time.",
          );
        body = {
          action: "transfer",
          amountCentavos: transferCentavos,
          reference: transfer.reference,
          transferredAt: new Date(`${transfer.time}+08:00`).toISOString(),
          transferChecked: true,
        };
        path = `${base}/${row.id}/refund`;
      }
      if (token) {
        const attemptId = row.id + ":" + action;
        const encoded = JSON.stringify(body);
        const prior = attempts.current.get(attemptId);
        if (prior && prior.body !== encoded)
          throw new Error(
            "An earlier request is uncertain. Retry its original evidence or refresh and reconcile before changing it.",
          );
        const attempt = prior ?? { key: crypto.randomUUID(), body: encoded };
        attempts.current.set(attemptId, attempt);
        const response = await writeApi(apiBase + path, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...body, requestKey: attempt.key }),
        });
        const data = await response.json();
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500)
            attempts.current.delete(attemptId);
          throw new Error(data.error);
        }
        attempts.current.delete(attemptId);
        notifySuccess(
          action === "transfer"
            ? "Manual refund transfer recorded. No money was sent by this application."
            : action === "approve"
              ? "Cancellation approved. Any refund still requires a manual transfer."
              : "Cancellation or refund action recorded.",
        );
        await load();
      } else {
        if (
          action === "transfer" &&
          transferCentavos > refundAmounts(row).remaining
        )
          throw new Error("The transfer exceeds the refund amount still due.");
        const next = rows.map((item) => {
          if (item.id !== row.id) return item;
          if (action === "request")
            return {
              ...item,
              requestedAt: new Date().toISOString(),
              eligibility:
                item.channel === "walk_in"
                  ? "walk_in_policy_pending"
                  : "eligible",
            };
          if (action === "approve")
            return {
              ...item,
              approved: true,
              refundCentavos: item.originalCentavos,
              refundedCentavos: 0,
              remainingRefundCentavos: item.originalCentavos,
              decisionReason: reason,
              refundStatus: "due" as const,
              refundDueCentavos: item.originalCentavos,
              netChargeCentavos: 20000,
              balanceCentavos: -item.originalCentavos,
            };
          if (action === "reject")
            return { ...item, approved: false, decisionReason: reason };
          if (action === "claim")
            return {
              ...item,
              refundStatus: "processing" as const,
              payerName: payer.name,
              payerAccount: "SYNTHETIC-ACCOUNT",
              claimedBy: actor,
              verifiedAt: new Date().toISOString(),
            };
          const { refunded, remaining } = refundAmounts(item);
          const balance = remaining - transferCentavos;
          const transferredAt = new Date(
            `${transfer.time}+08:00`,
          ).toISOString();
          return {
            ...item,
            refundStatus:
              balance > 0 ? ("processing" as const) : ("recorded" as const),
            refundedCentavos: refunded + transferCentavos,
            remainingRefundCentavos: balance,
            transferReference: transfer.reference,
            transferredAt,
            transferHistory: [
              {
                amountCentavos: transferCentavos,
                reference: transfer.reference,
                transferredAt,
              },
              ...(item.transferHistory ?? []),
            ],
            balanceCentavos: item.balanceCentavos + transferCentavos,
            refundDueCentavos: item.refundDueCentavos - transferCentavos,
          };
        });
        setRows(next);
      }
      if (action === "transfer")
        setTransferForms((current) => ({
          ...current,
          [row.id]: emptyTransfer,
        }));
      setMessage(
        action === "approve"
          ? "Cancellation recorded; manual refund remains outstanding."
          : action === "transfer"
            ? "Manual transfer recorded. No payment was sent by this application."
            : "Action recorded.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Action unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="staff-change-desk mx-auto max-w-5xl space-y-4 rounded-2xl border border-subtle bg-white p-6 text-main">
      <h1 className="text-2xl font-bold text-primary">
        Cancellations and refunds
      </h1>
      {!token && (
        <p>
          Synthetic preview only. Labels are not actual hotel room identifiers
          or payer accounts.
        </p>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer font-semibold text-primary">
          Cancellation and refund policy
        </summary>
        <p>
          No money is transferred by this application. A screenshot alone never
          verifies a payer or refund.
        </p>
        <p>
          Online free cancellation: request before 60 minutes from original
          staff confirmation, before that item checks in. Walk-in and extra-bed
          refund policies remain pending.
        </p>
      </details>
      {token && !guest && enabled && (
        <StaffRefundIssueQueue key={token} token={token} />
      )}
      {token && !enabled && (
        <p>
          Live cancellation and refund writes are closed pending acceptance.
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {confirmation &&
        (() => {
          const row = rows.find((r) => r.id === confirmation.id);
          if (!row) return null;
          const payer = payerForms[row.id] ?? emptyPayer;
          return (
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Confirm cancellation or refund action"
              className="rounded-xl border border-primary bg-selected p-4 space-y-3"
            >
              <h2 className="font-semibold">
                Review {readableLabel(confirmation.action)} for{" "}
                {row.id.slice(0, 8).toUpperCase()}
              </h2>
              <p>
                {confirmation.action === "transfer"
                  ? `Amount sent: PHP ${transferForms[row.id]?.amount ?? ""}.`
                  : `Item amount: ${peso(row.refundCentavos ?? row.originalCentavos)}.`}{" "}
                {confirmation.action === "approve"
                  ? "Only this item will be cancelled and its capacity released. A manual refund remains due."
                  : ""}
              </p>
              {(confirmation.action === "claim" ||
                confirmation.action === "transfer") && (
                <p>
                  Original payer destination: {row.payerName ?? payer.name} /{" "}
                  {row.payerAccount ?? payer.account}. No money will be sent by
                  this application. Record a transfer only after verifying it
                  actually completed.
                </p>
              )}
              <button
                className={button}
                onClick={() => void submit(row, confirmation.action, true)}
              >
                Confirm {confirmation.action}
              </button>
              <button className={button} onClick={() => setConfirmation(null)}>
                Back to review
              </button>
            </div>
          );
        })()}

      {token && (
        <button className={button} onClick={() => void load()}>
          Refresh cancellation history
        </button>
      )}
      {token && !guest && (
        <div className="staff-change-lookup space-y-2 border-b border-subtle pb-4">
          <label className="grid gap-1">
            Room item reference
            <input
              className="rounded-lg border border-subtle p-2"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
            />
          </label>
          {requestId && (
            <GuestCancellationRequest token={token} itemId={requestId} staff />
          )}
        </div>
      )}
      {token && !guest && historyStatus === "loading" && (
        <StaffLoadingSkeleton label="Loading cancellation history…">
          {rows.length ? (
            <SkeletonBlock className="h-4 w-44" />
          ) : (
            <article className="space-y-4 rounded-xl border border-subtle bg-white/80 p-4">
              <SkeletonBlock className="h-5 w-44" />
              <SkeletonBlock className="h-8 w-28" />
              <SkeletonBlock className="h-3 w-48" />
              <SkeletonBlock className="h-3 w-3/4" />
              <div className="flex flex-wrap items-center gap-3 border-t border-subtle pt-4">
                <SkeletonBlock className="h-6 w-24" />
                <SkeletonBlock className="h-4 w-36" />
              </div>
              <SkeletonBlock className="h-10 w-44" />
            </article>
          )}
        </StaffLoadingSkeleton>
      )}
      {token && !guest && historyStatus === "ready" && !rows.length && (
        <p className="staff-change-empty">
          No cancellation records on this page.
        </p>
      )}
      {rows.map((row) => {
        const payer = payerForms[row.id] ?? emptyPayer;
        const transfer = transferForms[row.id] ?? emptyTransfer;
        const { refunded, remaining } = refundAmounts(row);
        const setPayer = (value: PayerForm) =>
          setPayerForms({ ...payerForms, [row.id]: value });
        const setTransfer = (value: TransferForm) =>
          setTransferForms({ ...transferForms, [row.id]: value });
        return (
          <article
            key={row.id}
            className="space-y-3 rounded-xl border border-subtle p-4"
          >
            <h2 className="font-semibold">
              Cancellation {row.id.slice(0, 8).toUpperCase()}
            </h2>
            <details className="text-sm">
              <summary className="min-h-11 cursor-pointer text-muted">
                Full references
              </summary>
              <p className="break-all">Cancellation: {row.id}</p>
              <p className="break-all">Reservation: {row.reservationId}</p>
            </details>
            <p>
              Booking {row.reservationId.slice(0, 8).toUpperCase()} &middot;{" "}
              {row.channel === "online" ? "Online" : "Walk-in"}
            </p>
            <p>
              {hotelTime(row.startAt)} to {hotelTime(row.endAt)} - Original item
              price {peso(row.originalCentavos)}
            </p>
            <p>
              Original confirmation:{" "}
              {row.confirmationAt
                ? hotelTime(row.confirmationAt)
                : "Not applicable / unconfirmed"}
            </p>
            <p>{readableLabel(row.eligibility)}</p>
            {row.requestedAt && (
              <p>
                Requested {hotelTime(row.requestedAt)} -{" "}
                {row.approved === null
                  ? "Awaiting staff review; capacity retained"
                  : row.approved
                    ? "Cancelled; refund " + readableLabel(row.refundStatus)
                    : "Request rejected"}
              </p>
            )}
            {row.approved && (
              <>
                <p className="staff-change-refund-amount">
                  Item refund {peso(row.refundCentavos ?? 0)} · Refunded{" "}
                  {peso(refunded)} · Still due {peso(remaining)}
                </p>
                <p>
                  Reservation refund outstanding {peso(row.refundDueCentavos)} -
                  Total amount {peso(row.netChargeCentavos)} - Account balance{" "}
                  {peso(row.balanceCentavos)} (negative means credit owed)
                </p>
              </>
            )}
            {!token && row.eligibility === "not_requested" && (
              <button
                className={button}
                onClick={() => void submit(row, "request")}
              >
                Request cancellation - {row.id}
              </button>
            )}
            {!guest && row.requestedAt && row.approved === null && (
              <>
                <label className="grid gap-1">
                  Decision reason - {row.id}
                  <textarea
                    className="rounded-lg border border-subtle p-2"
                    maxLength={1000}
                    value={reasons[row.id] ?? ""}
                    onChange={(e) =>
                      setReasons({ ...reasons, [row.id]: e.target.value })
                    }
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    className={button}
                    disabled={
                      !enabled || busy || row.eligibility !== "eligible"
                    }
                    onClick={() => void submit(row, "approve")}
                  >
                    Approve cancellation - {row.id}
                  </button>
                  <button
                    className={button}
                    disabled={!enabled || busy}
                    onClick={() => void submit(row, "reject")}
                  >
                    Reject request - {row.id}
                  </button>
                </div>
              </>
            )}
            {!guest && row.refundStatus === "due" && (
              <>
                <p>
                  Verify original payer from the actual incoming transaction.
                  Booking contact is not sufficient. Claim processing before
                  making any external transfer.
                </p>
                <label className="grid gap-1">
                  Original payer name
                  <input
                    className="rounded-lg border border-subtle p-2"
                    maxLength={120}
                    value={payer.name}
                    onChange={(e) =>
                      setPayer({ ...payer, name: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1">
                  Verified original GCash account
                  <input
                    className="rounded-lg border border-subtle p-2"
                    autoComplete="off"
                    maxLength={20}
                    value={payer.account}
                    onChange={(e) =>
                      setPayer({ ...payer, account: e.target.value })
                    }
                  />
                </label>
                <label className="grid gap-1">
                  Verification evidence note
                  <textarea
                    className="rounded-lg border border-subtle p-2"
                    maxLength={1000}
                    value={payer.note}
                    onChange={(e) =>
                      setPayer({ ...payer, note: e.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <input
                    type="checkbox"
                    checked={payer.ledger}
                    onChange={(e) =>
                      setPayer({ ...payer, ledger: e.target.checked })
                    }
                  />{" "}
                  Actual receiving ledger checked
                </label>
                <label className="block">
                  <input
                    type="checkbox"
                    checked={payer.matched}
                    onChange={(e) =>
                      setPayer({ ...payer, matched: e.target.checked })
                    }
                  />{" "}
                  Destination matches the verified original payer
                </label>
                <button
                  className={button}
                  disabled={!enabled || busy}
                  onClick={() => void submit(row, "claim")}
                >
                  Verify payer and claim processing - {row.id}
                </button>
              </>
            )}
            {!guest && row.refundStatus === "processing" && (
              <>
                <p>
                  Processing claimed by {row.claimedBy}. Verified destination:{" "}
                  {row.payerName} / {row.payerAccount}. If transfer outcome is
                  uncertain, reconcile it; do not transfer again. Processing
                  claims do not expire automatically.
                </p>
                {row.claimedBy === actor && (
                  <>
                    <label className="grid gap-1">
                      Actual amount sent (PHP)
                      <input
                        className="rounded-lg border border-subtle p-2"
                        inputMode="decimal"
                        value={transfer.amount}
                        onChange={(e) =>
                          setTransfer({ ...transfer, amount: e.target.value })
                        }
                      />
                    </label>
                    <label className="grid gap-1">
                      Actual transfer reference
                      <input
                        className="rounded-lg border border-subtle p-2"
                        maxLength={100}
                        value={transfer.reference}
                        onChange={(e) =>
                          setTransfer({
                            ...transfer,
                            reference: e.target.value,
                          })
                        }
                      />
                    </label>
                    <ManilaDateTimeInput
                      label="Actual transfer time (Manila)"
                      value={transfer.time}
                      onChange={(time) => setTransfer({ ...transfer, time })}
                    />
                    <label className="block">
                      <input
                        type="checkbox"
                        checked={transfer.checked}
                        onChange={(e) =>
                          setTransfer({
                            ...transfer,
                            checked: e.target.checked,
                          })
                        }
                      />{" "}
                      Actual outgoing GCash transfer verified
                    </label>
                    <button
                      className={button}
                      disabled={!enabled || busy}
                      onClick={() => void submit(row, "transfer")}
                    >
                      Record transfer - {row.id}
                    </button>
                  </>
                )}
              </>
            )}
            {!guest && Boolean(row.transferHistory?.length) && (
              <details>
                <summary>Recorded transfers</summary>
                <ul>
                  {row.transferHistory.map((entry) => (
                    <li key={entry.reference}>
                      {peso(entry.amountCentavos)} ·{" "}
                      {hotelTime(entry.transferredAt)} · {entry.reference}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {row.refundStatus === "recorded" && (
              <p>
                Full refund recorded{" "}
                {row.transferredAt ? hotelTime(row.transferredAt) : ""}
              </p>
            )}
            {!guest &&
              token &&
              row.approved &&
              (row.refundCentavos ?? 0) > 0 && (
                <StaffRefundIssue token={token} kind="room" itemId={row.id} />
              )}
          </article>
        );
      })}
      {token && (
        <nav
          aria-label="Cancellation history pages"
          className="staff-change-pages flex flex-wrap items-center gap-3"
        >
          <button
            className={button}
            disabled={page === 0 || busy}
            onClick={() => setPage(page - 1)}
          >
            Previous page
          </button>
          <span>Page {page + 1}</span>
          <button
            className={button}
            disabled={rows.length < 100 || busy}
            onClick={() => setPage(page + 1)}
          >
            Next page
          </button>
        </nav>
      )}
      {!token && (
        <button
          className={button}
          onClick={() => {
            setRows(fixtures());
            setMessage("");
            setReasons({});
            setPayerForms({});
            setTransferForms({});
          }}
        >
          Reset synthetic preview
        </button>
      )}
    </section>
  );
}
export function GuestCancellationRequest({
  token,
  itemId,
  staff = false,
}: {
  token: string;
  itemId: string;
  staff?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ key: string; reason: string } | null>(null);
  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      if (attempt.current && attempt.current.reason !== reason.trim())
        throw new Error(
          "Retry the original reason or reconcile the uncertain request.",
        );
      attempt.current ??= { key: crypto.randomUUID(), reason: reason.trim() };
      const response = await writeApi(
        `${apiBase}/${staff ? "staff" : "guest"}/cancellations/${itemId}${staff ? "/request" : ""}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestKey: attempt.current.key,
            reason: attempt.current.reason,
          }),
        },
      );
      const data = await response.json();
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500)
          attempt.current = null;
        throw new Error(data.error);
      }
      setMessage(
        `Request recorded: ${data.eligibility}. Await staff review; no refund has been transferred.`,
      );
      notifySuccess("Cancellation requested. Awaiting staff review.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Request unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-3 space-y-2">
      <label className="grid gap-1">
        Cancellation reason
        <textarea
          className="rounded-lg border border-subtle p-2"
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className={button}
        disabled={busy || !reason.trim()}
        onClick={() => void submit()}
      >
        {staff
          ? "Request cancellation of this room item"
          : "Request cancellation"}
      </button>
      {message && <p role="status">{message}</p>}
    </div>
  );
}
