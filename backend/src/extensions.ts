import { chooseRescheduleRoom } from "./rescheduling.js";
import type { PoolClient } from "pg";
import type { Express, RequestHandler, Response } from "express";
import type { StayChangeRow } from "@staytrack/shared";
import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { BookingError } from "./booking-quote.js";
import {
  parseExtensionInput,
  stayBase,
  stayId,
  stayMoney,
  stayObject,
} from "./stay-change-policy.js";
import {
  stayAction,
  staySource,
  readStayFinancials,
  readStayPayee,
  recordStayReceipt,
  allocateStayReceipt,
  releaseStayAllocation,
  recordStayReview,
  decideStayReview,
  creditStayCharge,
} from "./stay-finance.js";
// Same fixed-room allocator as X02; SQL guards repeat full-precision validation.
async function validateExtensionCapacity(db: PoolClient, id: string) {
  const q = (
    await db.query(
      `select q.*,b.claim_id,b.category_code,c.category_id,c.room_id,c.buffer_minutes from staytrack.stay_extension_requests q join staytrack.room_bookings b on b.id=q.room_booking_id join staytrack.inventory_claims c on c.id=b.claim_id where q.id=$1`,
      [id],
    )
  ).rows[0];
  await db.query(
    "select id from staytrack.stay_receipts where id in(select receipt_id from staytrack.stay_active_allocations where extension_request_id=$1) order by id for update",
    [id],
  );
  await db.query("select pg_advisory_xact_lock($1::bigint)", [q.category_id]);
  await db.query(
    "select id from staytrack.inventory_claims where id=$1 for update",
    [q.claim_id],
  );
  await db.query("lock table staytrack.room_blocks in share mode");
  const room = (
    await db.query(
      "select id from staytrack.rooms where id=$1 and active and operational_state='occupied' for update",
      [q.room_id],
    )
  ).rows[0];
  if (!room) throw new BookingError("Original occupied room required.", 409);
  const obstacles = (
    await db.query(
      `select x.room_id,x.start_at,x.end_at from staytrack.room_blocks x where x.room_id=$1 and tstzrange(x.start_at,x.end_at,'[)') && tstzrange($2,$3::timestamptz+$4*interval '1 minute','[)') union all select c.room_id,c.start_at,c.buffered_end_at from staytrack.inventory_claims c where c.room_id=$1 and c.id<>$5 and c.state not in ('released','expired') and tstzrange(c.start_at,c.buffered_end_at,'[)') && tstzrange($2,$3::timestamptz+$4*interval '1 minute','[)')`,
      [q.room_id, q.old_end, q.new_end, q.buffer_minutes, q.claim_id],
    )
  ).rows;
  const category = q.category_code as "double_standard" | "family_executive";
  if (
    chooseRescheduleRoom(
      [{ id: Number(q.room_id), category, ready: true }],
      [],
      obstacles.map((x) => ({
        roomId: Number(x.room_id),
        start: +x.start_at,
        end: x.end_at === null ? null : +x.end_at,
      })),
      {
        id,
        category,
        roomId: Number(q.room_id),
        start: +q.old_end,
        end: +q.new_end + q.buffer_minutes * 60000,
        bufferMinutes: 0,
      },
    ) === null
  )
    throw new BookingError(
      "Additional interval conflicts with shared capacity.",
      409,
    );
}
export async function requestExtension(
  actor: string,
  item: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = parseExtensionInput(value);
  return stayAction(
    actor,
    item,
    v,
    "stay_extension_requests",
    v,
    async (db, h) =>
      (
        await db.query(
          `insert into staytrack.stay_extension_requests(room_booking_id,actor_auth_user_id,request_key,request_hash,reason,expected_revision,blocks) values($1,$2,$3,$4,$5,$6,$7) returning id`,
          [
            item,
            actor,
            v.requestKey,
            h,
            v.reason,
            v.expectedRevision,
            v.blocks,
          ],
        )
      ).rows[0].id,
    pool,
  );
}
export async function decideExtension(
  actor: string,
  id: string,
  value: unknown,
  pool = databasePool(),
) {
  const v = stayObject(value, [
    "requestKey",
    "reason",
    "expectedRevision",
    "approved",
  ]);
  const b = stayBase(v);
  stayMoney(v.expectedRevision);
  if (typeof v.approved !== "boolean")
    throw new BookingError("Explicit staff decision required.");
  const q = await staySource("stay_extension_requests", id, pool);
  return stayAction(
    actor,
    q.room_booking_id,
    b,
    "stay_extension_decisions",
    { id, ...v },
    async (db, h) => {
      if (v.approved) await validateExtensionCapacity(db, id);
      return (
        await db.query(
          `insert into staytrack.stay_extension_decisions(request_id,room_booking_id,actor_auth_user_id,request_key,request_hash,reason,expected_revision,approved) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [
            id,
            q.room_booking_id,
            actor,
            b.requestKey,
            h,
            b.reason,
            v.expectedRevision,
            v.approved,
          ],
        )
      ).rows[0].id;
    },
    pool,
  );
}
export async function stayChangeRows(
  actor: string,
  page = 0,
  pool = databasePool(),
  pageSize = 100,
): Promise<StayChangeRow[]> {
  stayId(actor);
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000000)
    throw new BookingError("Invalid page.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new BookingError("Invalid page size.");
  return claimTransaction(async (db) => {
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
          "select to_regclass('staytrack.stay_item_terms') is not null as installed",
        )
      ).rows[0].installed
    )
      return [];
    const rows = (
      await db.query(
        `select b.id,b.reservation_id as "reservationId",b.category_code as category,r.channel,rm.code as "roomCode",t.original_checkout_at as "originalCheckoutAt",t.effective_checkout_at as "effectiveCheckoutAt",b.stay_extension_revision::float8 as revision,(o.room_booking_id is not null) as "checkedOut" from staytrack.room_bookings b join staytrack.reservations r on r.id=b.reservation_id join staytrack.stay_item_terms t on t.room_booking_id=b.id join staytrack.room_check_ins s on s.room_booking_id=b.id join staytrack.rooms rm on rm.id=s.room_id left join staytrack.room_checkouts o on o.room_booking_id=b.id order by (o.room_booking_id is not null),t.effective_checkout_at,b.id limit $2 offset $1`,
        [page * pageSize, pageSize],
      )
    ).rows;
    for (const r of rows) {
      r.financials = await readStayFinancials(db, r.reservationId);
      r.extensions = (
        await db.query(
          `select q.id,q.old_end as "oldEnd",q.new_end as "newEnd",q.expected_revision::float8 as revision,q.blocks,q.amount_centavos::float8 as "amountCentavos",coalesce(a.amount,0)::float8 as "fundedCentavos",d.approved,q.reason,
 case when d.id is not null then null when o.room_booking_id is not null then 'Item has checked out' when q.expected_revision<>b.stay_extension_revision or q.id is distinct from b.pending_extension_id then 'Request is stale' when q.new_end<=clock_timestamp() then 'Purchased checkout has passed' when q.package_snapshot is distinct from staytrack.stay_quote_current(b.category_code,q.blocks) then 'Package quote changed' when coalesce(a.amount,0)<q.amount_centavos/2+q.amount_centavos%2 then 'At least 50% verified allocation required'
 when exists(select 1 from staytrack.room_blocks x where x.room_id=c.room_id and tstzrange(x.start_at,x.end_at,'[)') && tstzrange(q.old_end,q.new_end+c.buffer_minutes*interval '1 minute','[)')) or exists(select 1 from staytrack.inventory_claims x where x.id<>c.id and x.room_id=c.room_id and x.state not in ('released','expired') and tstzrange(x.start_at,x.buffered_end_at,'[)') && tstzrange(q.old_end,q.new_end+c.buffer_minutes*interval '1 minute','[)')) then 'Capacity or maintenance conflict'
 when exists(select 1 from staytrack.stay_charge_reviews v join staytrack.stay_charge_entries e on e.review_id=v.id where v.room_booking_id=b.id and v.kind='overtime' and tstzrange(v.start_at,v.end_at,'[)') && tstzrange(q.old_end,q.new_end,'[)')) then 'Overtime decision conflicts' else null end as blocker
 from staytrack.stay_extension_requests q join staytrack.room_bookings b on b.id=q.room_booking_id join staytrack.inventory_claims c on c.id=b.claim_id left join staytrack.stay_extension_decisions d on d.request_id=q.id left join staytrack.room_checkouts o on o.room_booking_id=b.id left join lateral(select sum(amount_centavos) as amount from staytrack.stay_active_allocations where extension_request_id=q.id) a on true where q.room_booking_id=$1 order by q.recorded_at`,
          [r.id],
        )
      ).rows;
      const details = await db.query(
        `select
          to_json(array(select row_to_json(detail) from (
          select s.id,s.method,s.amount_centavos::float8 as "amountCentavos",(s.amount_centavos-coalesce(a.amount,0))::float8 as "availableCentavos" from staytrack.stay_receipts s left join lateral(select sum(amount_centavos) as amount from staytrack.stay_active_allocations where receipt_id=s.id) a on true where s.reservation_id=$2 order by s.recorded_at
          ) detail)) as receipts,
          to_json(array(select row_to_json(detail) from (
          select a.id,a.receipt_id as "receiptId",a.extension_request_id as "requestId",a.charge_id as "chargeId",a.amount_centavos::float8 as "amountCentavos",exists(select 1 from staytrack.stay_receipt_allocations r where r.release_of=a.id) as released,(a.extension_request_id is not null and (d.approved=false or (d.id is null and exists(select 1 from staytrack.stay_extension_requests q join staytrack.room_bookings b on b.id=q.room_booking_id where q.id=a.extension_request_id and (q.expected_revision<>b.stay_extension_revision or q.new_end<=clock_timestamp() or q.package_snapshot is distinct from staytrack.stay_quote_current(b.category_code,q.blocks))))) and not exists(select 1 from staytrack.stay_receipt_allocations r where r.release_of=a.id)) as releasable from staytrack.stay_receipt_allocations a left join staytrack.stay_extension_decisions d on d.request_id=a.extension_request_id where a.room_booking_id=$1 and a.kind='allocate' order by a.recorded_at
          ) detail)) as allocations,
          to_json(array(select row_to_json(detail) from (
          select e.id,e.kind,e.amount_centavos::float8 as "amountCentavos",coalesce(a.amount,0)::float8 as "paidCentavos",coalesce(c.amount,0)::float8 as "creditedCentavos",e.review_id as "reviewId",e.reason from staytrack.stay_charge_entries e left join lateral(select sum(amount_centavos) as amount from staytrack.stay_active_allocations where charge_id=e.id or (e.extension_request_id is not null and extension_request_id=e.extension_request_id)) a on true left join lateral(select sum(amount_centavos) as amount from staytrack.stay_charge_entries where credit_of=e.id) c on true where e.room_booking_id=$1 order by e.recorded_at
          ) detail)) as charges,
          to_json(array(select row_to_json(detail) from (
          select q.id,q.kind,q.reason,(extract(epoch from(q.end_at-q.start_at))*1000)::float8 as "durationMs",exists(select 1 from staytrack.stay_charge_entries where review_id=q.id) as decided,case when o.room_booking_id is not null then 'New fees after departure are policy pending' when q.policy_version_id is null or q.disclosure_id is null then 'Owner-approved rate and prior disclosure required' else null end as blocker from staytrack.stay_charge_reviews q left join staytrack.room_checkouts o on o.room_booking_id=q.room_booking_id where q.room_booking_id=$1 order by q.recorded_at
          ) detail)) as reviews`,
        [r.id, r.reservationId],
      );
      Object.assign(r, details.rows[0]);
    }
    return JSON.parse(JSON.stringify(rows)) as StayChangeRow[];
  }, pool);
}
export function registerStayChanges(
  app: Express,
  staff: RequestHandler,
  enabled = false,
  pool?: ReturnType<typeof databasePool>,
) {
  app.use(
    [
      "/staff/stay-changes",
      "/staff/stay-extensions",
      "/staff/stay-receipts",
      "/staff/stay-allocations",
      "/staff/stay-reviews",
      "/staff/stay-charges",
    ],
    (_req, res, next) => {
      res.setHeader("Cache-Control", "no-store");
      next();
    },
  );
  const fail = (res: Response, e: unknown) =>
    res.status(e instanceof BookingError ? e.status : 503).json({
      error:
        e instanceof BookingError
          ? e.message
          : "Stay changes unavailable. Approved migration and acceptance required.",
    });
  const closed: RequestHandler = (_req, res, next) => {
    if (!enabled) {
      res
        .status(503)
        .json({ error: "Live stay changes are closed pending acceptance." });
      return;
    }
    next();
  };
  app.get("/staff/stay-changes", staff, async (req, res) => {
    try {
      res.json({
        items: await stayChangeRows(
          res.locals.actorId,
          Number(req.query.page ?? 0),
          pool,
          Number(req.query.pageSize ?? 100),
        ),
        payeeLabel: await readStayPayee(pool ?? databasePool()),
        enabled,
      });
    } catch (e) {
      fail(res, e);
    }
  });
  const actions = [
    ["/staff/stay-changes/:id/extensions", requestExtension],
    ["/staff/stay-extensions/:id/decision", decideExtension],
    ["/staff/stay-changes/:id/receipts", recordStayReceipt],
    ["/staff/stay-receipts/:id/allocations", allocateStayReceipt],
    ["/staff/stay-allocations/:id/release", releaseStayAllocation],
    ["/staff/stay-changes/:id/reviews", recordStayReview],
    ["/staff/stay-reviews/:id/decision", decideStayReview],
    ["/staff/stay-charges/:id/credit", creditStayCharge],
  ] as const;
  for (const [path, action] of actions)
    app.post(path, staff, closed, async (req, res) => {
      try {
        if (action === recordStayReview && req.body?.kind === "smoking")
          throw new BookingError("Only overtime reviews are available.", 400);
        res.json(
          await action(
            res.locals.actorId,
            String(req.params.id),
            req.body,
            pool,
          ),
        );
      } catch (e) {
        fail(res, e);
      }
    });
}
