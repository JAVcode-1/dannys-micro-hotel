import { hasControlCharacters } from "./payment-media.js";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { StayEvent, StayFinancials } from "@staytrack/shared";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { BookingError } from "./booking-quote.js";
import { normalizePaymentReference } from "./payment-review.js";
import {
  stayBase,
  stayId,
  stayInstant,
  stayMoney,
  stayObject,
} from "./stay-change-policy.js";
type Table = (readonly [
  "stay_receipts",
  "stay_receipt_allocations",
  "stay_charge_reviews",
  "stay_charge_entries",
  "stay_extension_requests",
  "stay_extension_decisions",
])[number];
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
export async function stayAction(
  actor: string,
  itemId: string,
  input: { requestKey: string; reason: string },
  table: Table,
  body: unknown,
  write: (db: PoolClient, requestHash: string) => Promise<string>,
  pool = databasePool(),
): Promise<StayEvent> {
  stayId(actor);
  stayId(itemId);
  const requestHash = createHash("sha256")
    .update(JSON.stringify(canonical({ itemId, ...input, body })))
    .digest("hex");
  try {
    return await claimTransaction(async (db) => {
      if (
        !(
          await db.query(
            "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
            [actor],
          )
        ).rowCount
      )
        throw new BookingError("Staff access denied.", 403);
      if (
        !(
          await db.query(
            "select b.id from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=$1 for update of r,b",
            [itemId],
          )
        ).rowCount
      )
        throw new BookingError("Room item not found.", 404);
      const prior = (
        await db.query(
          `select id,room_booking_id,request_hash,recorded_at from staytrack.${table} where actor_auth_user_id=$1 and request_key=$2`,
          [actor, input.requestKey],
        )
      ).rows[0];
      if (prior) {
        if (prior.request_hash !== requestHash)
          throw new BookingError(
            "Retry conflicts with an earlier action.",
            409,
          );
        return {
          id: prior.id,
          kind: table,
          roomBookingId: prior.room_booking_id,
          recordedAt: prior.recorded_at.toISOString(),
        };
      }
      const id = await write(db, requestHash);
      const row = (
        await db.query(
          `select recorded_at from staytrack.${table} where id=$1`,
          [id],
        )
      ).rows[0];
      return {
        id,
        kind: table,
        roomBookingId: itemId,
        recordedAt: row.recorded_at.toISOString(),
      };
    }, pool);
  } catch (e) {
    if (
      ["23505", "23514", "23503", "23P01", "P0001", "40001", "40P01"].includes(
        (e as { code?: string }).code ?? "",
      )
    )
      throw Object.assign(
        new BookingError(
          "Action conflicts with current funding, policy, schedule or capacity. Refresh and reconcile.",
          409,
        ),
        { cause: e },
      );
    throw e;
  }
}
export async function staySource(
  table: Table,
  id: string,
  pool = databasePool(),
) {
  stayId(id);
  const r = (
    await pool.query(`select * from staytrack.${table} where id=$1`, [id])
  ).rows[0];
  if (!r) throw new BookingError("Event not found.", 404);
  return r;
}
export function parseStayReceipt(value: unknown) {
  const v = stayObject(value, [
    "requestKey",
    "reason",
    "method",
    "amountCentavos",
    "receivedAt",
    "cashReceived",
    "verification",
    "extensionRequestId",
  ]);
  const b = {
    ...stayBase(v),
    ...(v.extensionRequestId !== undefined && {
      extensionRequestId: stayId(v.extensionRequestId),
    }),
  };
  const amount = stayMoney(v.amountCentavos, true);
  const receivedAt =
    v.method === "cash" && v.receivedAt === undefined
      ? null
      : stayInstant(v.receivedAt);
  if (v.method === "cash") {
    if (v.cashReceived !== true || v.verification !== undefined)
      throw new BookingError("Staff cash-received attestation required.");
    return {
      ...b,
      method: "cash" as const,
      amountCentavos: amount,
      receivedAt,
      cashReceived: true as const,
    };
  }
  if (v.method !== "gcash" || v.cashReceived !== undefined)
    throw new BookingError("Supported payment method required.");
  const verification = stayObject(v.verification, [
    "reference",
    "recipient",
    "ledgerChecked",
    "receivingAccountChecked",
    "timeChecked",
  ]);
  if (
    verification.ledgerChecked !== true ||
    verification.receivingAccountChecked !== true ||
    verification.timeChecked !== true ||
    typeof verification.recipient !== "string" ||
    !verification.recipient.trim() ||
    verification.recipient.length > 120 ||
    hasControlCharacters(verification.recipient)
  )
    throw new BookingError(
      "Verify the actual GCash ledger, recipient and time.",
    );
  return {
    ...b,
    method: "gcash" as const,
    amountCentavos: amount,
    receivedAt,
    verification: {
      reference: normalizePaymentReference(verification.reference as string),
      recipient: verification.recipient.trim(),
      ledgerChecked: true as const,
      receivingAccountChecked: true as const,
      timeChecked: true as const,
    },
  };
}
export async function readStayPayee(db: Pick<PoolClient, "query">) {
  const result = await db.query<{ payee: string }>(
    "select trim(payee_label) as payee from staytrack.payment_qr where id=true for share",
  );
  return result.rows[0]?.payee || null;
}

async function insertStayAllocation(
  db: PoolClient,
  allocation: {
    receiptId: string;
    itemId: string;
    actor: string;
    requestKey: string;
    requestHash: string;
    reason: string;
    extensionRequestId: string | null;
    chargeId: string | null;
    amountCentavos: number;
  },
) {
  const result = await db.query(
    `insert into staytrack.stay_receipt_allocations
      (receipt_id,room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,extension_request_id,charge_id,amount_centavos)
      values($1,$2,$3,$4,$5,$6,'allocate',$7,$8,$9) returning id`,
    [
      allocation.receiptId,
      allocation.itemId,
      allocation.actor,
      allocation.requestKey,
      allocation.requestHash,
      allocation.reason,
      allocation.extensionRequestId,
      allocation.chargeId,
      allocation.amountCentavos,
    ],
  );
  return result.rows[0].id;
}

export async function recordStayReceipt(
  actor: string,
  item: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = parseStayReceipt(value);
  return stayAction(
    actor,
    item,
    v,
    "stay_receipts",
    v,
    async (db, h) => {
      const p = "verification" in v ? v.verification : undefined;
      if (p && (await readStayPayee(db)) !== p.recipient)
        throw new BookingError(
          "The verified GCash account changed or is missing. Refresh and check the account again.",
          409,
        );
      const receiptId = (
        await db.query(
          `insert into staytrack.stay_receipts(room_booking_id,reservation_id,actor_auth_user_id,request_key,request_hash,reason,method,amount_centavos,received_at,cash_received,normalized_reference,recipient,ledger_checked,receiving_account_checked,time_checked) values($1,(select reservation_id from staytrack.room_bookings where id=$1),$2,$3,$4,$5,$6,$7,coalesce($8::timestamptz,clock_timestamp()),$9,$10,$11,$12,$13,$14) returning id`,
          [
            item,
            actor,
            v.requestKey,
            h,
            v.reason,
            v.method,
            v.amountCentavos,
            v.receivedAt,
            v.method === "cash" ? true : null,
            p?.reference ?? null,
            p?.recipient ?? null,
            p?.ledgerChecked ?? null,
            p?.receivingAccountChecked ?? null,
            p?.timeChecked ?? null,
          ],
        )
      ).rows[0].id;
      if (v.extensionRequestId)
        await insertStayAllocation(db, {
          receiptId,
          itemId: item,
          actor,
          requestKey: h,
          requestHash: h,
          reason: v.reason,
          extensionRequestId: v.extensionRequestId,
          chargeId: null,
          amountCentavos: v.amountCentavos,
        });
      return receiptId;
    },
    pool,
  );
}
export async function allocateStayReceipt(
  actor: string,
  receiptId: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = stayObject(value, [
    "requestKey",
    "reason",
    "extensionRequestId",
    "chargeId",
    "amountCentavos",
  ]);
  const b = stayBase(v);
  const amount = stayMoney(v.amountCentavos, true);
  if ((v.extensionRequestId === undefined) === (v.chargeId === undefined))
    throw new BookingError("Choose exactly one obligation.");
  const target = stayId(v.extensionRequestId ?? v.chargeId);
  const source = await staySource(
    v.extensionRequestId ? "stay_extension_requests" : "stay_charge_entries",
    target,
    pool,
  );
  stayId(receiptId);
  return stayAction(
    actor,
    source.room_booking_id,
    b,
    "stay_receipt_allocations",
    { receiptId, ...v },
    (db, h) =>
      insertStayAllocation(db, {
        receiptId,
        itemId: source.room_booking_id,
        actor,
        requestKey: b.requestKey,
        requestHash: h,
        reason: b.reason,
        extensionRequestId: v.extensionRequestId ? target : null,
        chargeId: v.chargeId ? target : null,
        amountCentavos: amount,
      }),
    pool,
  );
}
export async function releaseStayAllocation(
  actor: string,
  id: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = stayBase(stayObject(value, ["requestKey", "reason"]));
  const a = await staySource("stay_receipt_allocations", id, pool);
  return stayAction(
    actor,
    a.room_booking_id,
    v,
    "stay_receipt_allocations",
    { id, ...v },
    async (db, h) =>
      (
        await db.query(
          `insert into staytrack.stay_receipt_allocations(receipt_id,room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,extension_request_id,charge_id,amount_centavos,release_of) values($1,$2,$3,$4,$5,$6,'release',$7,$8,$9,$10) returning id`,
          [
            a.receipt_id,
            a.room_booking_id,
            actor,
            v.requestKey,
            h,
            v.reason,
            a.extension_request_id,
            a.charge_id,
            a.amount_centavos,
            id,
          ],
        )
      ).rows[0].id,
    pool,
  );
}
export async function readStayFinancials(
  db: Pick<PoolClient, "query">,
  reservationId: string,
): Promise<StayFinancials> {
  const r = (
    await db.query(
      "select * from staytrack.reservation_financials where reservation_id=$1",
      [reservationId],
    )
  ).rows[0];
  if (!r) throw new BookingError("Reservation not found.", 404);
  const n = (key: string) => {
    const value = Number(r[key]);
    if (!Number.isSafeInteger(value))
      throw new Error("Unsafe financial projection");
    return value;
  };
  return {
    originalCentavos: n("original_centavos"),
    netChargeCentavos: n("net_charge_centavos"),
    collectedCentavos: n("collected_centavos"),
    balanceCentavos: n("balance_centavos"),
    settlementDueCentavos: n("settlement_due_centavos"),
    refundDueCentavos: n("refund_due_centavos"),
    unallocatedX03Centavos: n("unallocated_x03_centavos"),
    pendingExtensionFundsCentavos: n("pending_extension_funds_centavos"),
  };
}
export async function recordStayReview(
  actor: string,
  item: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = stayObject(value, [
    "requestKey",
    "reason",
    "kind",
    "startAt",
    "endAt",
    "policyVersionId",
    "disclosureId",
  ]);
  const b = stayBase(v);
  if (!["overtime", "smoking"].includes(String(v.kind)))
    throw new BookingError("Supported review required.");
  const start = v.kind === "overtime" ? stayInstant(v.startAt) : null,
    end = v.kind === "overtime" ? stayInstant(v.endAt) : null;
  if (
    v.kind === "smoking" &&
    (v.startAt !== undefined || v.endAt !== undefined)
  )
    throw new BookingError("Smoking incidents have no overtime interval.");
  const policy =
      v.policyVersionId === undefined ? null : stayId(v.policyVersionId),
    disclosure = v.disclosureId === undefined ? null : stayId(v.disclosureId);
  return stayAction(
    actor,
    item,
    b,
    "stay_charge_reviews",
    v,
    async (db, h) =>
      (
        await db.query(
          `insert into staytrack.stay_charge_reviews(room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,start_at,end_at,policy_version_id,disclosure_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
          [
            item,
            actor,
            b.requestKey,
            h,
            b.reason,
            v.kind,
            start,
            end,
            policy,
            disclosure,
          ],
        )
      ).rows[0].id,
    pool,
  );
}
export async function decideStayReview(
  actor: string,
  id: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = stayObject(value, ["requestKey", "reason", "action"]);
  const b = stayBase(v);
  if (!["charge", "waive"].includes(String(v.action)))
    throw new BookingError("Choose a documented charge or waiver.");
  const r = await staySource("stay_charge_reviews", id, pool);
  return stayAction(
    actor,
    r.room_booking_id,
    b,
    "stay_charge_entries",
    { id, ...v },
    async (db, h) => {
      let amount = 0;
      if (v.action === "charge") {
        const q = (
          await db.query(
            `select case when r.kind='smoking' then p.rate_centavos when p.rounding='ceil' then ceil(extract(epoch from (r.end_at-r.start_at))/60)*p.rate_centavos when p.rounding='floor' then floor(extract(epoch from (r.end_at-r.start_at))/60)*p.rate_centavos when p.rounding='exact' and mod(extract(epoch from (r.end_at-r.start_at)),60)=0 then extract(epoch from (r.end_at-r.start_at))/60*p.rate_centavos end as amount from staytrack.stay_charge_reviews r join staytrack.stay_charge_policy_versions p on p.id=r.policy_version_id where r.id=$1`,
            [id],
          )
        ).rows[0];
        if (q?.amount == null)
          throw new BookingError(
            "Owner-approved financial policy and prior disclosure required.",
            409,
          );
        amount = stayMoney(Number(q.amount), true);
      }
      return (
        await db.query(
          `insert into staytrack.stay_charge_entries(room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,review_id,amount_centavos) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [
            r.room_booking_id,
            actor,
            b.requestKey,
            h,
            b.reason,
            v.action === "waive" ? "waiver_record" : r.kind + "_debit",
            id,
            amount,
          ],
        )
      ).rows[0].id;
    },
    pool,
  );
}
export async function creditStayCharge(
  actor: string,
  id: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = stayObject(value, ["requestKey", "reason", "amountCentavos"]);
  const b = stayBase(v);
  const amount = stayMoney(v.amountCentavos, true);
  const c = await staySource("stay_charge_entries", id, pool);
  return stayAction(
    actor,
    c.room_booking_id,
    b,
    "stay_charge_entries",
    { id, ...v },
    async (db, h) =>
      (
        await db.query(
          `insert into staytrack.stay_charge_entries(room_booking_id,actor_auth_user_id,request_key,request_hash,reason,kind,credit_of,amount_centavos) values($1,$2,$3,$4,$5,'charge_credit',$6,$7) returning id`,
          [c.room_booking_id, actor, b.requestKey, h, b.reason, id, amount],
        )
      ).rows[0].id,
    pool,
  );
}
