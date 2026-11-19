import { useEffect, useRef, useState } from "react";
import type { StayChangeRow } from "@staytrack/shared";
import { apiBase } from "./staff-auth";
import { hotelTime, peso } from "./BookingPlanner";
const field =
  "mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white p-2 text-base";
const button =
  "min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white disabled:opacity-50";
type Submit = (path: string, body: Record<string, unknown>) => Promise<void>;
function Item({
  row,
  enabled,
  submit,
}: {
  row: StayChangeRow;
  enabled: boolean;
  submit: Submit;
}) {
  const [reason, setReason] = useState(""),
    [blocks, setBlocks] = useState(
      row.category === "family_executive" ? "360" : "180",
    ),
    [amount, setAmount] = useState(""),
    [method, setMethod] = useState("gcash"),
    [reference, setReference] = useState(""),
    [recipient, setRecipient] = useState(""),
    [verified, setVerified] = useState(false),
    [receivedAt, setReceivedAt] = useState(""),
    [receipt, setReceipt] = useState(""),
    [target, setTarget] = useState(""),
    [kind, setKind] = useState("smoking"),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [confirmed, setConfirmed] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const retry = useRef(new Map<string, { hash: string; key: string }>());
  const valid = enabled && !pending && !!reason.trim() && confirmed;
  async function act(path: string, body: Record<string, unknown>) {
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
      setConfirmed(false);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Unavailable. Your draft is preserved.",
      );
    } finally {
      setPending(false);
    }
  }
  const cents = /^\d+(?:\.\d{1,2})?$/.test(amount)
      ? Number(amount.split(".")[0]) * 100 +
        Number((amount.split(".")[1] ?? "").padEnd(2, "0"))
      : NaN,
    moneyValid = Number.isSafeInteger(cents) && cents > 0;
  const local = (v: string) =>
    v.length === 16 ? v + ":00+08:00" : v + "+08:00";
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
      <p>Original checkout: {hotelTime(row.originalCheckoutAt)}</p>
      <p className="font-semibold">
        Current checkout: {hotelTime(row.effectiveCheckoutAt)}{" "}
        {row.checkedOut ? " |  Departed" : ""}
      </p>
      <dl className="my-4 grid gap-2 sm:grid-cols-2">
        <div>
          <dt>Original booked charge</dt>
          <dd>{peso(f.originalCentavos)}</dd>
        </div>
        <div>
          <dt>Total charges after adjustments</dt>
          <dd>{peso(f.netChargeCentavos)}</dd>
        </div>
        <div>
          <dt>Actual money received</dt>
          <dd>{peso(f.collectedCentavos)}</dd>
        </div>
        <div>
          <dt>Required settlement</dt>
          <dd>{peso(f.settlementDueCentavos)}</dd>
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
      <p className="text-sm text-muted">
        Additional money is committed to its selected obligation. Receipt entry
        alone does not activate an extension or settle original debt.
      </p>
      <label className="mt-4 block">
        Staff reason
        <textarea
          className={field}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
        />
      </label>
      <label className="my-3 flex gap-2">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        I reviewed this room, the evidence and the selected action.
      </label>
      <details open>
        <summary className="my-3 cursor-pointer font-semibold">
          Extension approval
        </summary>
        <label>
          Additional package
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
          className={button}
          disabled={
            !valid ||
            row.checkedOut ||
            row.extensions.some((q) => q.approved === null)
          }
          onClick={() =>
            void act(`/staff/stay-changes/${row.id}/extensions`, {
              expectedRevision: row.revision,
              blocks: [Number(blocks)],
            })
          }
        >
          Request extension quote
        </button>
        <p className="my-2 text-sm">
          Checkout adds to the purchased schedule, including late requests. At
          least 50% of the additional package charge must be verified and
          allocated before staff approval. Existing extra-bed fees are not
          charged again.
        </p>
        {row.extensions.map((q) => (
          <section key={q.id} className="my-3 rounded-lg bg-selected p-3">
            <p>
              {q.blocks.map((x) => x / 60 + "h").join(" + ")} |{" "}
              {peso(q.amountCentavos)} |{" "}
              {q.approved === true
                ? "Activated"
                : q.approved === false
                  ? "Rejected"
                  : "Awaiting approval"}
            </p>
            <p>
              {hotelTime(q.oldEnd)} ? {hotelTime(q.newEnd)}
            </p>
            <p>
              Allocated: {peso(q.fundedCentavos)} | Required minimum:{" "}
              {peso(Math.ceil(q.amountCentavos / 2))}
            </p>
            {q.blocker && <p>{q.blocker}</p>}
            {q.approved === null && (
              <div className="flex flex-wrap gap-2">
                <button
                  className={button}
                  disabled={!valid || !!q.blocker}
                  onClick={() =>
                    void act(`/staff/stay-extensions/${q.id}/decision`, {
                      expectedRevision: q.revision,
                      approved: true,
                    })
                  }
                >
                  Approve funded extension
                </button>
                <button
                  className={button}
                  disabled={!valid}
                  onClick={() =>
                    void act(`/staff/stay-extensions/${q.id}/decision`, {
                      expectedRevision: q.revision,
                      approved: false,
                    })
                  }
                >
                  Reject extension
                </button>
              </div>
            )}
          </section>
        ))}
      </details>
      <details>
        <summary className="my-3 cursor-pointer font-semibold">
          Verified additional payments and allocation
        </summary>
        <label>
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
              setVerified(false);
            }}
          >
            <option value="gcash">GCash</option>
            {row.channel === "walk_in" && <option value="cash">Cash</option>}
          </select>
        </label>
        <label>
          Received time (Manila)
          <input
            type="datetime-local"
            className={field}
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
          />
        </label>
        {method === "gcash" && (
          <>
            <label>
              Actual ledger reference
              <input
                className={field}
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <label>
              Verified receiving account
              <input
                className={field}
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
              />
            </label>
          </>
        )}
        <label className="my-3 flex gap-2">
          <input
            type="checkbox"
            checked={verified}
            onChange={(e) => setVerified(e.target.checked)}
          />
          {method === "cash"
            ? "I personally received this cash."
            : "I checked the actual ledger, receiving account, amount and time. A screenshot alone is insufficient."}
        </label>
        <button
          className={button}
          disabled={
            !valid ||
            !moneyValid ||
            !verified ||
            !receivedAt ||
            (method === "gcash" && (!reference.trim() || !recipient.trim()))
          }
          onClick={() =>
            void act(`/staff/stay-changes/${row.id}/receipts`, {
              method,
              amountCentavos: cents,
              receivedAt: local(receivedAt),
              ...(method === "cash"
                ? { cashReceived: true }
                : {
                    verification: {
                      reference,
                      recipient,
                      ledgerChecked: true,
                      receivingAccountChecked: true,
                      timeChecked: true,
                    },
                  }),
            })
          }
        >
          Record actual receipt
        </button>
        <label className="mt-4 block">
          Receipt to allocate
          <select
            className={field}
            value={receipt}
            onChange={(e) => setReceipt(e.target.value)}
          >
            <option value="">Choose receipt</option>
            {row.receipts.map((r) => (
              <option key={r.id} value={r.id}>
                {r.method} | available {peso(r.availableCentavos)} |{" "}
                {r.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Obligation
          <select
            className={field}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">Choose obligation</option>
            {row.extensions
              .filter((q) => q.approved !== false)
              .map((q) => (
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
                  {peso(c.amountCentavos - c.paidCentavos - c.creditedCentavos)}{" "}
                  remaining
                </option>
              ))}
          </select>
        </label>
        <p>
          Allocation amount uses the PHP amount above. Allocate explicitly;
          activation does not count funds twice.
        </p>
        <button
          className={button}
          disabled={!valid || !moneyValid || !receipt || !target}
          onClick={() =>
            void act(`/staff/stay-receipts/${receipt}/allocations`, {
              amountCentavos: cents,
              ...(target.startsWith("extension:")
                ? { extensionRequestId: target.slice(10) }
                : { chargeId: target.slice(7) }),
            })
          }
        >
          Allocate verified funds
        </button>
        {row.allocations.map((a) => (
          <p key={a.id} className="my-2">
            {peso(a.amountCentavos)} |{" "}
            {a.released
              ? "Commitment released"
              : a.requestId
                ? "Extension commitment"
                : "Charge allocation"}{" "}
            {a.releasable && (
              <button
                className={button}
                disabled={!valid}
                onClick={() =>
                  void act(`/staff/stay-allocations/${a.id}/release`, {})
                }
              >
                Release rejected commitment
              </button>
            )}
          </p>
        ))}
      </details>
      <details>
        <summary className="my-3 cursor-pointer font-semibold">
          Overtime and incident review
        </summary>
        <p>
          Charges are never automatic. Missing approved rates, rounding,
          extra-bed treatment or prior disclosure keeps financial posting
          blocked.
        </p>
        <label>
          Review type
          <select
            className={field}
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            <option value="smoking">Smoking incident</option>
            <option value="overtime">Overtime</option>
          </select>
        </label>
        {kind === "overtime" && (
          <>
            <label>
              Interval start (Manila)
              <input
                type="datetime-local"
                className={field}
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </label>
            <label>
              Interval end (Manila)
              <input
                type="datetime-local"
                className={field}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </label>
          </>
        )}
        <button
          className={button}
          disabled={!valid || (kind === "overtime" && (!start || !end))}
          onClick={() =>
            void act(`/staff/stay-changes/${row.id}/reviews`, {
              kind,
              ...(kind === "overtime"
                ? { startAt: local(start), endAt: local(end) }
                : {}),
            })
          }
        >
          Record review only
        </button>
        {row.reviews.map((r) => (
          <section key={r.id} className="my-3 rounded-lg bg-canvas p-3">
            <p>
              {r.kind} | {r.reason} |{" "}
              {r.decided ? "Decision recorded" : "Review only"}
            </p>
            {r.blocker && <p>{r.blocker}</p>}
            {!r.decided && (
              <div className="flex gap-2">
                <button
                  className={button}
                  disabled={!valid || !!r.blocker}
                  onClick={() =>
                    void act(`/staff/stay-reviews/${r.id}/decision`, {
                      action: "charge",
                    })
                  }
                >
                  Post approved policy charge
                </button>
                <button
                  className={button}
                  disabled={!valid}
                  onClick={() =>
                    void act(`/staff/stay-reviews/${r.id}/decision`, {
                      action: "waive",
                    })
                  }
                >
                  Record reasoned waiver
                </button>
              </div>
            )}
          </section>
        ))}
        {row.charges.map((c) => (
          <section key={c.id} className="my-3">
            <p>
              {c.kind.replaceAll("_", " ")} | {peso(c.amountCentavos)} | Paid{" "}
              {peso(c.paidCentavos)} | Credits {peso(c.creditedCentavos)}
            </p>
            {["overtime_debit", "smoking_debit"].includes(c.kind) && (
              <button
                className={button}
                disabled={
                  !valid ||
                  !moneyValid ||
                  cents > c.amountCentavos - c.paidCentavos - c.creditedCentavos
                }
                onClick={() =>
                  void act(`/staff/stay-charges/${c.id}/credit`, {
                    amountCentavos: cents,
                  })
                }
              >
                Credit unpaid charge using amount above
              </button>
            )}
          </section>
        ))}
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
    [message, setMessage] = useState("");
  const page = useRef(0);
  const [hasMore, setHasMore] = useState(false);
  async function refresh() {
    if (previewRows) return;
    try {
      const refreshed: StayChangeRow[] = [];
      let lastEnabled = false;
      for (let index = 0; index <= page.current; index++) {
        const response = await fetch(
          apiBase + "/staff/stay-changes?page=" + index,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Desk unavailable");
        refreshed.push(...data.items);
        lastEnabled = data.enabled === true;
        if (index === page.current) setHasMore(data.items.length === 100);
      }
      setRows(refreshed);
      setEnabled(lastEnabled);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Desk unavailable");
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
    await refresh();
  };
  return (
    <section className="mx-auto max-w-6xl">
      <h1 className="text-2xl font-bold">Extensions and additional charges</h1>
      <p className="my-3">
        {previewRows
          ? "Synthetic preview  |  no hotel data or transactions."
          : enabled
            ? "Staff approval and verified funds required."
            : "Live stay changes are closed pending acceptance."}
      </p>
      <button className={button} onClick={() => void refresh()}>
        Refresh current stays
      </button>
      {message && <p role="alert">{message}</p>}
      <div className="mt-5 grid gap-6">
        {rows.map((row) => (
          <Item key={row.id} row={row} enabled={enabled} submit={submit} />
        ))}
      </div>
      {hasMore && (
        <button
          className={button}
          onClick={() => {
            page.current++;
            void refresh();
          }}
        >
          Load more stays
        </button>
      )}
      {!rows.length && !message && (
        <p className="mt-4">
          No checked-in items available. Approved migration is required for this
          desk.
        </p>
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
          reviews: [
            {
              id: "synthetic-review",
              kind: "smoking",
              reason: "Synthetic review; rate pending",
              blocker: "Owner-approved rate and prior disclosure required",
              decided: false,
              durationMs: null,
            },
          ],
        },
      ]}
    />
  );
}
