import ManilaDateTimeInput from "./ManilaDateTimeInput";
import { parsePesoInput } from "./peso-input";
import { useEffect, useRef, useState } from "react";
import type { StayChangeRow } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";
import { hotelTime, peso } from "./BookingPlanner";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white p-2 text-base";
const button =
  "min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50";
type Submit = (path: string, body: Record<string, unknown>) => Promise<void>;

const currentManilaTime = () =>
  new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 16);

function draftCentavos(value: string) {
  try {
    return parsePesoInput(value);
  } catch {
    return NaN;
  }
}

function creditableAmount(charge: StayChangeRow["charges"][number]) {
  if (charge.kind !== "overtime_debit" && charge.kind !== "smoking_debit") {
    return 0;
  }
  return charge.amountCentavos - charge.paidCentavos - charge.creditedCentavos;
}

function Item({
  row,
  enabled,
  payeeLabel,
  submit,
}: {
  row: StayChangeRow;
  enabled: boolean;
  payeeLabel: string | null;
  submit: Submit;
}) {
  const [rejectReason, setRejectReason] = useState(""),
    [releaseReason, setReleaseReason] = useState(""),
    [creditReason, setCreditReason] = useState(""),
    [creditAmount, setCreditAmount] = useState(""),
    [blocks, setBlocks] = useState(
      row.category === "family_executive" ? "360" : "180",
    ),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState("gcash"),
    [reference, setReference] = useState(""),
    [cashReceivedAt, setCashReceivedAt] = useState(""),
    [paymentExtensionId, setPaymentExtensionId] = useState(""),
    [verified, setVerified] = useState(""),
    [receivedAt, setReceivedAt] = useState(""),
    [receipt, setReceipt] = useState(""),
    [allocationAmount, setAllocationAmount] = useState(""),
    [target, setTarget] = useState(""),
    [confirmedQuoteId, setConfirmedQuoteId] = useState(""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const retry = useRef(new Map<string, { hash: string; key: string }>());
  const canAct = enabled && !pending;
  async function act(
    path: string,
    body: Record<string, unknown>,
    reason: string,
  ) {
    const full = { ...body, reason: reason.trim() },
      hash = JSON.stringify(full);
    const previous = retry.current.get(path);
    const requestKey =
      previous?.hash === hash ? previous.key : crypto.randomUUID();
    retry.current.set(path, { hash, key: requestKey });
    setPending(true);
    setMessage("");
    try {
      await submit(path, { ...full, requestKey });
      setMessage(
        "Recorded. Refresh shows current funding and approval status.",
      );
      retry.current.delete(path);
      setConfirmedQuoteId("");
      return true;
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Unavailable. Your draft is preserved.",
      );
      return false;
    } finally {
      setPending(false);
    }
  }
  const cents = draftCentavos(amount);
  const allocationCents = draftCentavos(allocationAmount);
  const creditCents = draftCentavos(creditAmount);
  const creditValid =
    canAct &&
    !!creditReason.trim() &&
    Number.isSafeInteger(creditCents) &&
    creditCents > 0;
  const availableReceipts = row.receipts.filter((r) => r.availableCentavos > 0);
  const selectedReceipt = availableReceipts.find((r) => r.id === receipt);
  const moneyValid = Number.isSafeInteger(cents) && cents > 0;
  const local = (v: string) =>
    v.length === 16 ? v + ":00+08:00" : v + "+08:00";
  const pendingQuote = row.extensions.find((q) => q.approved === null);
  const extensionHistory = row.extensions.filter((q) => q.approved !== null);
  const minimumPayment = pendingQuote
    ? Math.ceil(pendingQuote.amountCentavos / 2)
    : 0;
  const fundingNeeded = pendingQuote
    ? Math.max(0, minimumPayment - pendingQuote.fundedCentavos)
    : 0;
  const payableExtensions = row.extensions.filter(
    (q) => q.approved !== false && q.amountCentavos > q.fundedCentavos,
  );
  const paymentExtension =
    payableExtensions.find((q) => q.id === paymentExtensionId) ??
    (pendingQuote
      ? payableExtensions.find((q) => q.id === pendingQuote.id)
      : payableExtensions[0]);
  const remaining = paymentExtension
    ? paymentExtension.amountCentavos - paymentExtension.fundedCentavos
    : null;
  const exceedsRemaining = remaining !== null && cents > remaining;
  const verificationKey = JSON.stringify([
    method,
    cents,
    method === "cash" ? cashReceivedAt : [reference, receivedAt, payeeLabel],
  ]);
  const paymentValid =
    canAct &&
    moneyValid &&
    verified === verificationKey &&
    (method === "cash" || (!!payeeLabel && !!receivedAt && !!reference.trim()));
  async function recordPayment(extensionRequestId?: string) {
    const time = method === "cash" ? cashReceivedAt : receivedAt;
    const recorded = await act(
      `/staff/stay-changes/${row.id}/receipts`,
      {
        method,
        amountCentavos: cents,
        ...(time && { receivedAt: local(time) }),
        ...(extensionRequestId && { extensionRequestId }),
        ...(method === "cash"
          ? { cashReceived: true }
          : {
              verification: {
                reference,
                recipient: payeeLabel,
                ledgerChecked: true,
                receivingAccountChecked: true,
                timeChecked: true,
              },
            }),
      },
      extensionRequestId
        ? "Staff verified and applied payment to the selected extension."
        : "Staff verified receipt of the additional payment.",
    );
    if (recorded) {
      setAmount("");
      setReference("");
      setReceivedAt("");
      setCashReceivedAt("");
      setVerified("");
    }
  }
  const f = row.financials;
  return (
    <article
      className="rounded-2xl border border-subtle bg-white p-5"
      aria-label={`Stay ${row.roomCode}`}
    >
      <h2 className="text-xl font-bold">
        Room {row.roomCode} |{" "}
        {row.category === "double_standard"
          ? "Double Standard"
          : "Family Executive"}
      </h2>
      {row.originalCheckoutAt !== row.effectiveCheckoutAt && (
        <details className="text-sm">
          <summary className="min-h-11 cursor-pointer text-muted">
            Original schedule
          </summary>
          <p>Original checkout: {hotelTime(row.originalCheckoutAt)}</p>
        </details>
      )}
      <p className="font-semibold">
        Current checkout: {hotelTime(row.effectiveCheckoutAt)}{" "}
        {row.checkedOut ? " |  Departed" : ""}
      </p>
      <dl className="my-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-sm text-muted">Total amount</dt>
          <dd className="font-semibold">{peso(f.netChargeCentavos)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Amount paid</dt>
          <dd className="font-semibold">{peso(f.collectedCentavos)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Remaining balance</dt>
          <dd className="font-semibold">{peso(f.settlementDueCentavos)}</dd>
        </div>
      </dl>
      <details className="my-4">
        <summary className="min-h-11 cursor-pointer font-semibold text-primary">
          Charges and payment breakdown
        </summary>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt>Original booked charge</dt>
            <dd>{peso(f.originalCentavos)}</dd>
          </div>
          <div>
            <dt>Unallocated additional funds</dt>
            <dd>{peso(f.unallocatedX03Centavos)}</dd>
          </div>
          <div>
            <dt>Pending extension funds</dt>
            <dd>{peso(f.pendingExtensionFundsCentavos)}</dd>
          </div>
        </dl>
        {row.charges.some((charge) => creditableAmount(charge) > 0) && (
          <div className="my-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              Credit amount (PHP)
              <input
                className={field}
                type="number"
                min="0.01"
                step="0.01"
                value={creditAmount}
                onChange={(event) => setCreditAmount(event.target.value)}
              />
            </label>
            <label className="block">
              Reason for credit
              <textarea
                className={field}
                value={creditReason}
                onChange={(event) => setCreditReason(event.target.value)}
                maxLength={1000}
              />
            </label>
          </div>
        )}
        {row.charges.map((charge) => {
          const maxCredit = creditableAmount(charge);
          return (
            <section key={charge.id} className="my-3">
              <p>
                {charge.kind.replaceAll("_", " ")} |{" "}
                {peso(charge.amountCentavos)} | Paid {peso(charge.paidCentavos)}{" "}
                | Credits {peso(charge.creditedCentavos)}
              </p>
              {maxCredit > 0 && (
                <button
                  className={button}
                  disabled={!creditValid || creditCents > maxCredit}
                  onClick={() =>
                    void act(
                      `/staff/stay-charges/${charge.id}/credit`,
                      { amountCentavos: creditCents },
                      creditReason,
                    )
                  }
                >
                  Credit unpaid charge
                </button>
              )}
            </section>
          );
        })}
      </details>
      <details>
        <summary className="my-3 cursor-pointer font-semibold text-primary">
          {row.checkedOut ? "Additional payments" : "Extend this stay"}
        </summary>
        <div className="space-y-5">
          {!row.checkedOut && (
            <section aria-label="Get extension quote">
              <h3 className="mb-3 font-semibold">1. Get an extension quote</h3>
              {pendingQuote ? (
                <dl className="grid gap-3 rounded-lg bg-selected p-4 text-sm sm:grid-cols-3">
                  <div>
                    <dt>New checkout</dt>
                    <dd className="font-semibold">
                      {hotelTime(pendingQuote.newEnd)}
                    </dd>
                  </div>
                  <div>
                    <dt>Extension price</dt>
                    <dd className="font-semibold">
                      {peso(pendingQuote.amountCentavos)}
                    </dd>
                  </div>
                  <div>
                    <dt>Minimum to approve</dt>
                    <dd className="font-semibold">{peso(minimumPayment)}</dd>
                  </div>
                </dl>
              ) : (
                <div>
                  <label className="block">
                    Additional stay length
                    <select
                      className={field}
                      value={blocks}
                      onChange={(e) => setBlocks(e.target.value)}
                    >
                      {(row.category === "family_executive"
                        ? [360, 720, 1440]
                        : [180, 360, 720, 1440]
                      ).map((x) => (
                        <option key={x} value={x}>
                          {x / 60} hours
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={button + " mt-3"}
                    disabled={!canAct}
                    onClick={() =>
                      void act(
                        `/staff/stay-changes/${row.id}/extensions`,
                        {
                          expectedRevision: row.revision,
                          blocks: [Number(blocks)],
                        },
                        "Staff requested a stay extension quote.",
                      )
                    }
                  >
                    Request extension quote
                  </button>
                  <p className="my-2 text-sm">
                    Added time starts at the current checkout. At least 50% of
                    the extension price must be paid before approval.
                  </p>
                </div>
              )}
            </section>
          )}
          <details open={Boolean(pendingQuote || paymentExtension)}>
            <summary className="my-3 cursor-pointer font-semibold">
              {row.checkedOut
                ? "Record or allocate payment"
                : "2. Record payment"}
            </summary>
            {paymentExtension && (
              <div className="mb-3">
                {payableExtensions.length > 1 && (
                  <label className="block">
                    Extension to pay
                    <select
                      className={field}
                      value={paymentExtension.id}
                      onChange={(event) =>
                        setPaymentExtensionId(event.target.value)
                      }
                    >
                      {payableExtensions.map((q) => (
                        <option key={q.id} value={q.id}>
                          Checkout {hotelTime(q.newEnd)}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <p className="text-sm">
                  Extension checkout {hotelTime(paymentExtension.newEnd)} ·{" "}
                  {peso(remaining ?? 0)} remaining
                </p>
              </div>
            )}
            <label className="block">
              Amount received (PHP)
              <input
                className={field}
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Method
              <select
                className={field}
                value={method}
                onChange={(e) => {
                  setMethod(e.target.value);
                  setVerified("");
                }}
              >
                <option value="gcash">GCash</option>
                <option value="cash">Cash</option>
              </select>
            </label>
            {method === "cash" ? (
              <div className="my-3 text-sm">
                <p>
                  {cashReceivedAt
                    ? `Received ${hotelTime(local(cashReceivedAt))}`
                    : "Current Manila time is recorded when you save."}
                </p>
                <button
                  type="button"
                  className="mt-2 min-h-11 rounded-lg border border-subtle px-3 font-semibold text-primary"
                  onClick={() => setCashReceivedAt(currentManilaTime())}
                >
                  Use current time
                </button>
                <details className="mt-2">
                  <summary className="cursor-pointer text-primary">
                    Enter a different receipt time
                  </summary>
                  <ManilaDateTimeInput
                    label="Cash received time (Manila)"
                    value={cashReceivedAt}
                    onChange={setCashReceivedAt}
                  />
                </details>
              </div>
            ) : (
              <>
                <ManilaDateTimeInput
                  label="GCash transaction time (Manila)"
                  value={receivedAt}
                  onChange={setReceivedAt}
                />
                <p className="text-sm text-muted">
                  Use the time shown in GCash for an earlier transfer.
                </p>
                <button
                  type="button"
                  className="my-2 min-h-11 rounded-lg border border-subtle px-3 text-sm font-semibold text-primary"
                  onClick={() => setReceivedAt(currentManilaTime())}
                >
                  Use current time
                </button>
                <label>
                  GCash transaction reference
                  <input
                    className={field}
                    value={reference}
                    placeholder="Paste the reference from GCash"
                    onChange={(e) => setReference(e.target.value)}
                  />
                </label>
                <p className="mt-2 text-sm">
                  Receiving GCash account{" "}
                  <strong>
                    {payeeLabel ?? "Set the verified account in Settings."}
                  </strong>
                </p>
              </>
            )}
            <label className="my-3 flex gap-2">
              <input
                type="checkbox"
                checked={verified === verificationKey}
                onChange={(e) =>
                  setVerified(e.target.checked ? verificationKey : "")
                }
              />
              {method === "cash"
                ? "I personally received this cash."
                : "I verified the reference, account, amount and time in GCash."}
            </label>
            <button
              className={button}
              disabled={!paymentValid || exceedsRemaining}
              onClick={() => void recordPayment(paymentExtension?.id)}
            >
              {paymentExtension
                ? "Record payment toward this extension"
                : "Record additional payment"}
            </button>
            {exceedsRemaining && (
              <p className="mt-2 text-sm text-muted">
                Use Manual allocation to split this payment across charges.
              </p>
            )}
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-primary">
                Manual allocation
              </summary>
              {paymentExtension && (
                <button
                  className={button + " mt-3"}
                  disabled={!paymentValid}
                  onClick={() => void recordPayment()}
                >
                  Record payment for later allocation
                </button>
              )}
              <label className="mt-4 block">
                Receipt to allocate
                <select
                  className={field}
                  value={receipt}
                  onChange={(e) => setReceipt(e.target.value)}
                >
                  <option value="">Choose receipt</option>
                  {availableReceipts.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.method} | available {peso(r.availableCentavos)} |{" "}
                      {r.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Apply payment to
                <select
                  className={field}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                >
                  <option value="">Choose obligation</option>
                  {payableExtensions.map((q) => (
                    <option key={q.id} value={"extension:" + q.id}>
                      Extension | {peso(q.amountCentavos - q.fundedCentavos)}{" "}
                      remaining
                    </option>
                  ))}
                  {row.charges
                    .filter((c) =>
                      ["overtime_debit", "smoking_debit"].includes(c.kind),
                    )
                    .map((c) => (
                      <option key={c.id} value={"charge:" + c.id}>
                        {c.kind.replaceAll("_", " ")} |{" "}
                        {peso(
                          c.amountCentavos -
                            c.paidCentavos -
                            c.creditedCentavos,
                        )}{" "}
                        remaining
                      </option>
                    ))}
                </select>
              </label>
              <label className="mt-2 block">
                Amount to apply (PHP)
                <input
                  className={field}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={allocationAmount}
                  onChange={(e) => setAllocationAmount(e.target.value)}
                />
              </label>
              <button
                className={button + " mt-3"}
                disabled={
                  !canAct ||
                  !selectedReceipt ||
                  !target ||
                  !Number.isSafeInteger(allocationCents) ||
                  allocationCents <= 0 ||
                  allocationCents > selectedReceipt.availableCentavos
                }
                onClick={() =>
                  void act(
                    `/staff/stay-receipts/${receipt}/allocations`,
                    {
                      amountCentavos: allocationCents,
                      ...(target.startsWith("extension:")
                        ? { extensionRequestId: target.slice(10) }
                        : { chargeId: target.slice(7) }),
                    },
                    "Staff allocated the verified payment to the selected obligation.",
                  )
                }
              >
                Allocate verified funds
              </button>
              {row.allocations.map((a) => (
                <div key={a.id} className="my-2">
                  {peso(a.amountCentavos)} |{" "}
                  {a.released
                    ? "Commitment released"
                    : a.requestId
                      ? "Extension commitment"
                      : "Charge allocation"}{" "}
                  {a.releasable && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-primary">
                        Release rejected commitment
                      </summary>
                      <label className="mt-2 block">
                        Reason for releasing funds
                        <textarea
                          className={field}
                          value={releaseReason}
                          onChange={(e) => setReleaseReason(e.target.value)}
                          maxLength={1000}
                        />
                      </label>
                      <button
                        className={button + " mt-2"}
                        disabled={!canAct || !releaseReason.trim()}
                        onClick={() =>
                          void act(
                            `/staff/stay-allocations/${a.id}/release`,
                            {},
                            releaseReason,
                          )
                        }
                      >
                        Confirm release
                      </button>
                    </details>
                  )}
                </div>
              ))}
            </details>
          </details>
          {pendingQuote && (
            <section
              className="border-t border-subtle pt-4"
              aria-label="Approve extension"
            >
              <h3 className="font-semibold">
                {row.checkedOut
                  ? "Resolve pending extension"
                  : "3. Approve the extension"}
              </h3>
              <p className="mt-2 text-sm">
                {row.checkedOut
                  ? "The guest has checked out. Review the pending quote."
                  : fundingNeeded > 0
                    ? `Record ${peso(fundingNeeded)} more to meet the minimum payment.`
                    : `Minimum payment met. New checkout: ${hotelTime(pendingQuote.newEnd)}.`}
              </p>
              {!row.checkedOut &&
                fundingNeeded === 0 &&
                pendingQuote.blocker && (
                  <p className="mt-2 text-sm">{pendingQuote.blocker}</p>
                )}
              {!row.checkedOut &&
                fundingNeeded === 0 &&
                !pendingQuote.blocker && (
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={confirmedQuoteId === pendingQuote.id}
                        onChange={(e) =>
                          setConfirmedQuoteId(
                            e.target.checked ? pendingQuote.id : "",
                          )
                        }
                      />
                      I confirm the new checkout time and funding.
                    </label>
                    <button
                      className={button}
                      disabled={!canAct || confirmedQuoteId !== pendingQuote.id}
                      onClick={() =>
                        void act(
                          `/staff/stay-extensions/${pendingQuote.id}/decision`,
                          {
                            expectedRevision: pendingQuote.revision,
                            approved: true,
                          },
                          "Staff approved the funded stay extension.",
                        )
                      }
                    >
                      Approve funded extension
                    </button>
                  </div>
                )}
              <details className="mt-3">
                <summary className="cursor-pointer text-primary">
                  Reject extension
                </summary>
                <label className="mt-2 block">
                  Reason for rejecting the extension
                  <textarea
                    className={field}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    maxLength={1000}
                  />
                </label>
                <button
                  className={button + " mt-2"}
                  disabled={!canAct || !rejectReason.trim()}
                  onClick={() =>
                    void act(
                      `/staff/stay-extensions/${pendingQuote.id}/decision`,
                      {
                        expectedRevision: pendingQuote.revision,
                        approved: false,
                      },
                      rejectReason,
                    )
                  }
                >
                  Confirm rejection
                </button>
              </details>
            </section>
          )}
          {extensionHistory.length > 0 && (
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-primary">
                Extension history
              </summary>
              <ul className="mt-2 space-y-2 text-sm">
                {extensionHistory.map((q) => (
                  <li key={q.id}>
                    {q.approved ? "Approved" : "Rejected"} · Checkout{" "}
                    {hotelTime(q.newEnd)} · {peso(q.amountCentavos)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      </details>
      {message && (
        <p role="status" className="mt-3">
          {message}
        </p>
      )}
    </article>
  );
}
export default function StayChangesDesk({
  token,
  previewRows,
}: {
  token?: string;
  previewRows?: StayChangeRow[];
}) {
  const [rows, setRows] = useState<StayChangeRow[]>(previewRows ?? []),
    [enabled, setEnabled] = useState(false),
    [payeeLabel, setPayeeLabel] = useState<string | null>(null),
    [message, setMessage] = useState("");
  const pageSize = 20;
  const page = useRef(0);
  const request = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(!previewRows);
  async function refresh(throughPage = page.current) {
    if (previewRows) return;
    const requestId = ++request.current;
    setLoading(true);
    try {
      const refreshed: StayChangeRow[] = [];
      let latestEnabled = false;
      let firstPayee: string | null = null;
      let hasNextPage = false;
      for (let index = 0; index <= throughPage; index++) {
        const response = await fetch(
          `${apiBase}/staff/stay-changes?page=${index}&pageSize=${pageSize}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const data = await response.json();
        if (requestId !== request.current) return;
        if (!response.ok) throw new Error(data.error ?? "Desk unavailable");
        refreshed.push(...data.items);
        latestEnabled = data.enabled === true;
        if (index === 0) firstPayee = data.payeeLabel ?? null;
        hasNextPage = data.items.length === pageSize;
        if (!hasNextPage) break;
      }
      page.current = Math.max(0, Math.ceil(refreshed.length / pageSize) - 1);
      setRows(refreshed);
      setEnabled(latestEnabled);
      setPayeeLabel(firstPayee);
      setHasMore(hasNextPage);
      setMessage("");
    } catch (e) {
      if (requestId === request.current) {
        setMessage(e instanceof Error ? e.message : "Desk unavailable");
      }
    } finally {
      if (requestId === request.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
  }, [token]); // existing item components retain their drafts on refresh
  const submit: Submit = async (path, body) => {
    const response = await fetch(apiBase + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) {
      await refresh();
      throw new Error(data.error ?? "Action unavailable.");
    }
    notifySuccess(
      "Stay change recorded. Review the current funding and approval status.",
    );
    await refresh();
  };
  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Extensions and charges</h1>
      <p className="my-3" role="status">
        {previewRows
          ? "Synthetic preview | no hotel data or transactions."
          : loading
            ? "Loading current stays…"
            : message && !rows.length
              ? null
              : enabled
                ? "Staff approval and verified funds required."
                : "Live stay changes are closed pending acceptance."}
      </p>
      <button
        className={button}
        disabled={loading}
        onClick={() => void refresh()}
      >
        Refresh current stays
      </button>
      {message && <p role="alert">{message}</p>}
      <div className="mt-5 grid gap-6">
        {rows.map((row) => (
          <Item
            key={row.id}
            row={row}
            enabled={enabled}
            payeeLabel={payeeLabel}
            submit={submit}
          />
        ))}
      </div>
      {hasMore && (
        <button
          className={button}
          disabled={loading}
          onClick={() => void refresh(page.current + 1)}
        >
          Load more stays
        </button>
      )}
      {!loading && !rows.length && !message && (
        <p className="staff-empty mt-4">No stays available for changes.</p>
      )}
    </section>
  );
}
export function StayChangesPreview() {
  const baseline = "2027-01-01T09:00:00.000Z";
  return (
    <StayChangesDesk
      previewRows={[
        {
          id: "synthetic-item",
          reservationId: "synthetic-reservation",
          category: "double_standard",
          channel: "walk_in",
          roomCode: "SYNTHETIC A",
          originalCheckoutAt: baseline,
          effectiveCheckoutAt: baseline,
          revision: 0,
          checkedOut: false,
          financials: {
            originalCentavos: 60000,
            netChargeCentavos: 60000,
            collectedCentavos: 45000,
            balanceCentavos: 15000,
            settlementDueCentavos: 30000,
            refundDueCentavos: 0,
            unallocatedX03Centavos: 0,
            pendingExtensionFundsCentavos: 15000,
          },
          extensions: [
            {
              id: "synthetic-extension",
              oldEnd: baseline,
              newEnd: "2027-01-01T12:00:00.000Z",
              revision: 0,
              blocks: [180],
              amountCentavos: 30000,
              fundedCentavos: 15000,
              approved: null,
              blocker: null,
              reason: "Synthetic extension request",
            },
          ],
          receipts: [
            {
              id: "synthetic-receipt",
              method: "cash",
              amountCentavos: 15000,
              availableCentavos: 0,
            },
          ],
          allocations: [],
          charges: [],
          reviews: [],
        },
      ]}
    />
  );
}
