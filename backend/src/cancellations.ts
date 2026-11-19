import type { Express, RequestHandler, Response } from "express";
import type { PoolClient } from "pg";
import type {
  CancellationRow,
  CancellationDecisionInput,
  RefundAction,
} from "@staytrack/shared";
import type { GuestIdentity } from "./guest-auth.js";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { BookingError } from "./booking-quote.js";
import { normalizePaymentReference } from "./payment-review.js";
import { hasControlCharacters } from "./payment-media.js";
const uuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v);
const key = (v: unknown): v is string =>
  typeof v === "string" && /^[A-Za-z0-9_-]{16,100}$/.test(v);
const note = (v: unknown, max = 1000): v is string =>
  typeof v === "string" &&
  !!v.trim() &&
  v.length <= max &&
  !hasControlCharacters(v);
export function cancellationEligibility(
  item: {
    channel: string;
    confirmationAt: number | null;
    checkedIn: boolean;
    extraBedCentavos: number;
    confirmed: boolean;
  },
  now: number,
) {
  if (item.channel === "walk_in") return "walk_in_policy_pending";
  if (item.checkedIn) return "checked_in";
  if (!item.confirmed || item.confirmationAt === null) return "unconfirmed";
  if (now < item.confirmationAt || now >= item.confirmationAt + 3600000)
    return "outside_window";
  return item.extraBedCentavos > 0 ? "extra_bed_policy_pending" : "eligible";
}
export function parseRefundAction(value: unknown): RefundAction {
  if (!value || typeof value !== "object")
    throw new BookingError("Choose a refund action.");
  const v = value as RefundAction;
  if (!key(v.requestKey)) throw new BookingError("Valid retry key required.");
  if (v.action === "claim") {
    if (
      !uuid(v.originalPaymentId) ||
      !note(v.payerName, 120) ||
      !note(v.payerAccount, 20) ||
      !note(v.verificationNote) ||
      v.ledgerChecked !== true ||
      v.originalPayerMatched !== true
    )
      throw new BookingError(
        "Verify the original payer against the actual receiving GCash ledger.",
      );
    const account = v.payerAccount.trim().replace(/^\+63/, "0");
    if (!/^09\d{9}$/.test(account))
      throw new BookingError("Use the verified original payer GCash account.");
    return {
      ...v,
      payerName: v.payerName.trim(),
      payerAccount: account,
      verificationNote: v.verificationNote.trim(),
    };
  }
  if (
    v.action !== "transfer" ||
    !Number.isSafeInteger(v.amountCentavos) ||
    v.amountCentavos <= 0 ||
    v.transferChecked !== true ||
    typeof v.transferredAt !== "string" ||
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v.transferredAt) ||
    !Number.isFinite(Date.parse(v.transferredAt))
  )
    throw new BookingError(
      "Record the exact verified manual transfer amount, reference and time.",
    );
  return {
    ...v,
    reference: normalizePaymentReference(v.reference),
    transferredAt: new Date(v.transferredAt).toISOString(),
  };
}
async function activeStaff(db: PoolClient, actor: string) {
  if (
    !(
      await db.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [actor],
      )
    ).rowCount
  )
    throw new BookingError("Staff access denied.", 403);
}
async function lockItem(db: PoolClient, id: string) {
  const row = (
    await db.query(
      `select b.id from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=$1 for update of r,b`,
      [id],
    )
  ).rows[0];
  if (!row) throw new BookingError("Room item not found.", 404);
}
function knownError(error: unknown): never {
  const code = (error as { code?: string }).code;
  if (code === "23505")
    throw new BookingError(
      "A conflicting request, refund claim or transfer reference already exists. Reconcile before retrying.",
      409,
    );
  if (code === "P0001" || code === "23514")
    throw new BookingError(
      "Action conflicts with current eligibility, verified payment, refund ownership or transfer evidence. Refresh and reconcile.",
      409,
    );
  throw error;
}
export async function requestCancellation(
  actor: GuestIdentity | { staffId: string },
  id: string,
  input: unknown,
  pool = databasePool(),
) {
  const v = input as { requestKey?: unknown; reason?: unknown } | null;
  if (!uuid(id) || !key(v?.requestKey) || !note(v?.reason))
    throw new BookingError(
      "Select an item and provide a reason and valid retry key.",
    );
  const reason = v.reason.trim();
  const retry = v.requestKey;
  const receivedAt = (
    await pool.query("select clock_timestamp()::text as received_at")
  ).rows[0].received_at;
  try {
    return await claimTransaction(async (db) => {
      if ("staffId" in actor) await activeStaff(db, actor.staffId);
      await lockItem(db, id);
      if ("id" in actor) {
        const owns = await db.query(
          `select 1 from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id where b.id=$1 and r.channel='online' and r.owner_auth_user_id=$2 and lower(r.verified_email)=$3`,
          [id, actor.id, actor.email.toLowerCase()],
        );
        if (!owns.rowCount) throw new BookingError("Room item not found.", 404);
      }
      const prior = (
        await db.query(
          "select * from staytrack.cancellation_requests where room_booking_id=$1",
          [id],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.request_key === retry &&
          prior.reason === reason &&
          ("staffId" in actor
            ? prior.staff_auth_user_id === actor.staffId
            : prior.guest_auth_user_id === actor.id &&
              prior.guest_email === actor.email.toLowerCase())
        )
          return prior;
        throw new BookingError(
          "A cancellation request already exists for this item.",
          409,
        );
      }
      const row = (
        await db.query(
          `insert into staytrack.cancellation_requests(room_booking_id,guest_auth_user_id,guest_email,staff_auth_user_id,request_key,reason,requested_at,eligibility)
   values($1,$2,$3,$4,$5,$6,$7,'unconfirmed') returning *`,
          [
            id,
            "id" in actor ? actor.id : null,
            "id" in actor ? actor.email.toLowerCase() : null,
            "staffId" in actor ? actor.staffId : null,
            retry,
            reason,
            receivedAt,
          ],
        )
      ).rows[0];
      if ("staffId" in actor)
        await db.query(
          "insert into staytrack.staff_audit(actor_auth_user_id,action) values ($1,'room.cancellation_requested')",
          [actor.staffId],
        );
      return row;
    }, pool);
  } catch (error) {
    knownError(error);
  }
}
export async function decideCancellation(
  actor: string,
  id: string,
  input: unknown,
  pool = databasePool(),
) {
  const v = input as CancellationDecisionInput | null;
  if (
    !uuid(id) ||
    !v ||
    !key(v.requestKey) ||
    typeof v.approved !== "boolean" ||
    !note(v.reason)
  )
    throw new BookingError(
      "Choose approve/reject, a reason and valid retry key.",
    );
  const reason = v.reason.trim();
  try {
    return await claimTransaction(async (db) => {
      await activeStaff(db, actor);
      await lockItem(db, id);
      const prior = (
        await db.query(
          "select * from staytrack.cancellation_decisions where room_booking_id=$1",
          [id],
        )
      ).rows[0];
      if (prior) {
        if (
          prior.actor_auth_user_id === actor &&
          prior.request_key === v.requestKey &&
          prior.approved === v.approved &&
          prior.reason === reason
        )
          return prior;
        throw new BookingError(
          "Cancellation already decided with a different request.",
          409,
        );
      }
      if (
        !(
          await db.query(
            "select 1 from staytrack.cancellation_requests where room_booking_id=$1",
            [id],
          )
        ).rowCount
      )
        throw new BookingError("Cancellation request not found.", 404);
      return (
        await db.query(
          `insert into staytrack.cancellation_decisions(room_booking_id,approved,refund_centavos,actor_auth_user_id,request_key,reason) values($1,$2,0,$3,$4,$5) returning *`,
          [id, v.approved, actor, v.requestKey, reason],
        )
      ).rows[0];
    }, pool);
  } catch (error) {
    knownError(error);
  }
}
export async function recordManualRefund(
  actor: string,
  id: string,
  input: unknown,
  pool = databasePool(),
) {
  if (!uuid(id)) throw new BookingError("Room item not found.", 404);
  const v = parseRefundAction(input);
  try {
    return await claimTransaction(async (db) => {
      await activeStaff(db, actor);
      await lockItem(db, id);
      const table = v.action === "claim" ? "refund_claims" : "refund_transfers";
      const prior = (
        await db.query(
          `select * from staytrack.${table} where room_booking_id=$1`,
          [id],
        )
      ).rows[0];
      if (prior) {
        const same =
          prior.actor_auth_user_id === actor &&
          prior.request_key === v.requestKey &&
          (v.action === "claim"
            ? prior.original_payment_id === v.originalPaymentId &&
              prior.payer_name === v.payerName &&
              prior.payer_account === v.payerAccount &&
              prior.verification_note === v.verificationNote
            : Number(prior.amount_centavos) === v.amountCentavos &&
              prior.normalized_reference === v.reference &&
              prior.transferred_at.toISOString() === v.transferredAt);
        if (same) return { roomBookingId: id, replayed: true };
        throw new BookingError(
          "Refund already claimed or recorded with different evidence. Reconcile; do not transfer again.",
          409,
        );
      }
      if (v.action === "claim")
        await db.query(
          `insert into staytrack.refund_claims(room_booking_id,original_payment_id,actor_auth_user_id,request_key,payer_name,payer_account,verification_note,ledger_checked,original_payer_matched) values($1,$2,$3,$4,$5,$6,$7,true,true)`,
          [
            id,
            v.originalPaymentId,
            actor,
            v.requestKey,
            v.payerName,
            v.payerAccount,
            v.verificationNote,
          ],
        );
      else
        await db.query(
          `insert into staytrack.refund_transfers(room_booking_id,actor_auth_user_id,request_key,amount_centavos,normalized_reference,transferred_at,transfer_checked) values($1,$2,$3,$4,$5,$6,true)`,
          [
            id,
            actor,
            v.requestKey,
            v.amountCentavos,
            v.reference,
            v.transferredAt,
          ],
        );
      return { roomBookingId: id, replayed: false };
    }, pool);
  } catch (error) {
    knownError(error);
  }
}
export async function cancellationRows(
  actor: { staffId: string } | GuestIdentity,
  pool = databasePool(),
  page = 0,
): Promise<CancellationRow[]> {
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000000)
    throw new BookingError("Invalid cancellation page.");
  const staff = "staffId" in actor;
  const result = await pool.query(
    `select b.id,b.reservation_id as "reservationId",r.channel,b.category_code as category,b.start_at as "startAt",b.end_at as "endAt",
 b.total_centavos::float8 as "originalCentavos",q.requested_at as "requestedAt",q.confirmation_at as "confirmationAt",q.eligibility,
 d.approved,d.refund_centavos::float8 as "refundCentavos",d.reason as "decisionReason",
 case when f.room_booking_id is not null then 'recorded' when c.room_booking_id is not null then 'processing' when d.approved and d.refund_centavos>0 then 'due' else 'not_due' end as "refundStatus",
 ${staff ? `(select p.id from staytrack.payment_submissions p join staytrack.verified_online_payments v on v.submission_id=p.id where p.reservation_id=r.id and p.status='confirmed' order by v.verified_at,p.id limit 1)` : "null::uuid"} as "paymentId",
 ${staff ? "c.actor_auth_user_id" : "null::uuid"} as "claimedBy",${staff ? "c.payer_name" : "null::text"} as "payerName",${staff ? "c.payer_account" : "null::text"} as "payerAccount",c.claimed_at as "verifiedAt",
 ${staff ? "f.normalized_reference" : "null::text"} as "transferReference",f.transferred_at as "transferredAt",
 a.balance_centavos::float8 as "balanceCentavos",a.refund_due_centavos::float8 as "refundDueCentavos",a.net_charge_centavos::float8 as "netChargeCentavos"
 from staytrack.cancellation_requests q join staytrack.room_bookings b on b.id=q.room_booking_id
 join staytrack.reservations r on r.id=b.reservation_id join staytrack.reservation_financials a on a.reservation_id=r.id
 left join staytrack.cancellation_decisions d using(room_booking_id) left join staytrack.refund_claims c using(room_booking_id) left join staytrack.refund_transfers f using(room_booking_id)
 ${staff ? "" : `where r.owner_auth_user_id=$1 and lower(r.verified_email)=$2 and r.channel='online'`}
 order by (f.room_booking_id is not null or d.approved=false),q.requested_at desc,b.id limit 100 offset ${staff ? "$1" : "$3"}`,
    staff ? [page * 100] : [actor.id, actor.email.toLowerCase(), page * 100],
  );
  return result.rows;
}
export async function assertNoCancellation(db: PoolClient, id: string) {
  const installed = (
    await db.query(
      "select to_regclass('staytrack.cancellation_requests') is not null as installed",
    )
  ).rows[0].installed;
  if (
    installed &&
    (
      await db.query(
        `select 1 from staytrack.cancellation_requests q left join staytrack.cancellation_decisions d using(room_booking_id) where q.room_booking_id=$1 and ((q.eligibility='eligible' and d.room_booking_id is null) or d.approved)`,
        [id],
      )
    ).rowCount
  )
    throw new BookingError(
      "Pending or approved cancellation prevents check-in.",
      409,
    );
}
export function registerCancellations(
  app: Express,
  staff: RequestHandler,
  verifyGuest: (token: string) => Promise<GuestIdentity | null>,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  const fail = (res: Response, error: unknown) =>
    res.status(error instanceof BookingError ? error.status : 503).json({
      error:
        error instanceof BookingError
          ? error.message
          : "Cancellation service unavailable. Approved migration and acceptance are required.",
    });
  const guest: RequestHandler = async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(req.header("authorization") ?? "");
    if (!match) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    try {
      const identity = await verifyGuest(match[1]);
      if (!identity) {
        res.status(403).json({ error: "Verified guest access required" });
        return;
      }
      res.locals.guest = identity;
      next();
    } catch {
      res.status(503).json({ error: "Guest access unavailable" });
    }
  };
  const closed: RequestHandler = (_req, res, next) => {
    if (!enabled) {
      res.status(503).json({
        error:
          "Live cancellation and refund writes are closed pending acceptance.",
      });
      return;
    }
    next();
  };
  app.use(
    ["/guest/cancellations", "/staff/cancellations"],
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  app.get("/guest/cancellations", guest, async (req, res) => {
    try {
      res.json({
        items: await cancellationRows(
          res.locals.guest,
          pool,
          Number(req.query.page ?? 0),
        ),
        enabled,
      });
    } catch (error) {
      fail(res, error);
    }
  });
  app.get("/staff/cancellations", staff, async (req, res) => {
    try {
      res.json({
        items: await cancellationRows(
          { staffId: res.locals.actorId },
          pool,
          Number(req.query.page ?? 0),
        ),
        enabled,
        actorId: res.locals.actorId,
      });
    } catch (error) {
      fail(res, error);
    }
  });
  app.post("/guest/cancellations/:id", guest, closed, async (req, res) => {
    try {
      res.json(
        await requestCancellation(
          res.locals.guest,
          String(req.params.id),
          req.body,
          pool,
        ),
      );
    } catch (error) {
      fail(res, error);
    }
  });
  app.post(
    "/staff/cancellations/:id/request",
    staff,
    closed,
    async (req, res) => {
      try {
        res.json(
          await requestCancellation(
            { staffId: res.locals.actorId },
            String(req.params.id),
            req.body,
            pool,
          ),
        );
      } catch (error) {
        fail(res, error);
      }
    },
  );
  app.post(
    "/staff/cancellations/:id/decision",
    staff,
    closed,
    async (req, res) => {
      try {
        res.json(
          await decideCancellation(
            res.locals.actorId,
            String(req.params.id),
            req.body,
            pool,
          ),
        );
      } catch (error) {
        fail(res, error);
      }
    },
  );
  app.post(
    "/staff/cancellations/:id/refund",
    staff,
    closed,
    async (req, res) => {
      try {
        res.json(
          await recordManualRefund(
            res.locals.actorId,
            String(req.params.id),
            req.body,
            pool,
          ),
        );
      } catch (error) {
        fail(res, error);
      }
    },
  );
}
