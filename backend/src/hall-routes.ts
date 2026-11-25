import { unifiedInstalled } from "./unified-booking.js";
import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { BookingError } from "./booking-quote.js";
import { databasePool } from "./database.js";
import {
  hallCommand,
  hallCommands,
  hallSettings,
  quoteInput,
  readHallExtensionQuote,
  type HallCommand,
} from "./hall-reservations.js";
import { hallPackagePrice, quoteHall } from "./hall-scheduling.js";
import { hallReport } from "./hall-reports.js";
import {
  hallRefundTransferAmount,
  hallStartPaymentIssue,
} from "./hall-payments.js";
import { readHallStatus } from "./hall-status.js";

export async function readPublicHallStatus(db: Pick<Pool, "query">) {
  const hall = await readHallStatus(db);
  return {
    status: hall.occupied
      ? "in_use"
      : hall.outOfServiceId
        ? "not_ready"
        : hall.reserved
          ? "reserved"
          : hall.ready
            ? "available"
            : "not_ready",
  };
}

export function registerHall(app: Express, staff: RequestHandler, pool?: Pool) {
  const handle =
    (fn: RequestHandler): RequestHandler =>
    async (req, res, next) => {
      res.set("Cache-Control", "private, no-store");
      try {
        await fn(req, res, next);
      } catch (error) {
        if (error instanceof BookingError)
          res.status(error.status).json({ error: error.message });
        else if ((error as { code?: string }).code === "23505")
          res.status(409).json({
            error: "This financial reference or record is already in use.",
          });
        else res.status(503).json({ error: "Function Hall is unavailable." });
      }
    };
  app.get(
    "/guest/hall-status",
    handle(async (_req, res) => {
      res.json(await readPublicHallStatus(pool ?? databasePool()));
    }),
  );
  if (!pool) return;
  app.get(
    "/staff/hall/settings",
    staff,
    handle(async (_req, res) => {
      res.json(await hallSettings(pool));
    }),
  );
  app.post(
    "/staff/hall/extension-quote",
    staff,
    handle(async (req, res) => {
      res.json(await readHallExtensionQuote(pool, req.body ?? {}));
    }),
  );
  app.post(
    "/staff/hall/quote",
    staff,
    handle(async (req, res) => {
      const {
        rows: [clock],
      } = await pool.query<{ now: Date; ready: boolean }>(
        "select clock_timestamp() as now, ready from staytrack.hall_resource where id=1",
      );
      const quote = quoteHall(
        quoteInput(req.body ?? {}),
        await hallSettings(pool),
        +clock.now,
        clock.ready,
      );
      const { rowCount } = await pool.query(
        `select 1 from staytrack.hall_claims where released_at is null
      and tstzrange(preparation_start,cleanup_end,'[)') && tstzrange($1,$2,'[)') limit 1`,
        [quote.protectedStart, quote.protectedEnd],
      );
      res.json({ ...quote, available: !rowCount });
    }),
  );
  app.get(
    "/staff/hall/reservations",
    staff,
    handle(async (req, res) => {
      const page = Number(req.query.page ?? 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 1000)
        throw new BookingError("Invalid page.");
      const unified = await unifiedInstalled(pool);
      const { rows } = await pool.query(
        `select r.id,r.claim_id,r.channel,r.organizer,r.requests,r.status,r.payment_resolution,r.actual_start,r.actual_end,
      ${unified ? "(select reservation_id from staytrack.online_hall_items where hall_reservation_id=r.id)" : "null::uuid"} as "unifiedReservationId",
      ${unified ? "(select state from staytrack.online_hall_items where hall_reservation_id=r.id)" : "null::text"} as "onlineState",
      r.quote_input, q.quote,c.released_at,h.ready,
      (r.status='confirmed' and c.preparation_start<=clock_timestamp() and exists(
        select 1 from staytrack.hall_reservations occupied where occupied.status='in_progress' and occupied.id<>r.id
      )) preparation_conflict,
      coalesce(q.total_centavos,0)::text total,
      coalesce(o.amount_centavos,0)::text overtime,
      coalesce(a.amount,0)::text refund_approved,
      (coalesce(a.amount,0)-coalesce(f.amount,0))::text "refundDue",
      (coalesce(p.amount,0) ${unified ? "+coalesce((select sum(amount_centavos) from staytrack.online_payment_allocations where hall_reservation_id=r.id),0)" : ""})::text collected,coalesce(f.amount,0)::text refunded,
      greatest(0,coalesce(q.total_centavos,0)+coalesce(o.amount_centavos,0)-coalesce(p.amount,0) ${unified ? "-coalesce((select sum(amount_centavos) from staytrack.online_payment_allocations where hall_reservation_id=r.id),0)" : ""}+coalesce(f.amount,0))::text balance
      from staytrack.hall_reservations r cross join staytrack.hall_resource h
      left join staytrack.hall_claims c on c.id=r.claim_id
      left join lateral(select quote,total_centavos from staytrack.hall_revisions where reservation_id=r.id order by id desc limit 1) q on true
      left join lateral(select sum(amount_centavos) amount from staytrack.hall_receipts where reservation_id=r.id) p on true
      left join lateral(select sum(amount_centavos) amount from staytrack.hall_refund_approvals where reservation_id=r.id) a on true
      left join lateral(select sum(${hallRefundTransferAmount}) amount from staytrack.hall_refund_approvals a
        join staytrack.hall_refund_transfers t on t.approval_id=a.id where a.reservation_id=r.id) f on true
      left join staytrack.hall_overtime_charges o on o.reservation_id=r.id
      order by (r.status='in_progress') desc,coalesce(c.event_start,r.created_at) desc,r.id limit 50 offset $1`,
        [(page - 1) * 50],
      );
      if (unified)
        for (const row of rows)
          row.changeRequests = (
            await pool.query(
              "select id,kind,reason,input,recorded_at from staytrack.online_hall_requests where hall_reservation_id=$1 and kind<>'cancel' order by recorded_at desc limit 20",
              [row.id],
            )
          ).rows;
      for (const row of rows) {
        if (row.status === "confirmed") {
          const gross = BigInt(row.collected);
          row.startPaymentIssue = hallStartPaymentIssue(
            row.channel === "walk_in" && !row.unifiedReservationId,
            BigInt(row.total),
            gross - BigInt(row.refunded),
            gross - BigInt(row.refund_approved),
          );
        }
        delete row.refund_approved;
        if (row.status === "inquiry" && !row.unifiedReservationId) {
          const { start, minutes } = row.quote_input;
          const price = hallPackagePrice(start, minutes).total;
          const net = Math.max(0, Number(row.collected) - Number(row.refunded));
          row.inquiryPrice = price;
          row.depositDue = Math.max(0, Math.ceil(price / 2) - net);
        }
      }
      const hall = await readHallStatus(pool);
      res.json({ entries: rows, hall });
    }),
  );
  app.get(
    "/staff/hall/reservations/:id/finances",
    staff,
    handle(async (req, res) => {
      const id = String(req.params.id);
      if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id))
        throw new BookingError("Invalid reservation.");
      const { rows } = await pool.query(
        `
        select r.id,
        coalesce((select json_agg(p order by p.received_at,p.id) from
          (select id,actor,method,amount_centavos::text amount,normalized_reference reference,evidence,received_at
           from staytrack.hall_receipts where reservation_id=r.id) p),'[]') receipts,
        coalesce((select json_agg(f order by f.id) from
          (select a.id,a.amount_centavos::text amount,a.reason,
            coalesce(p.amount,0)::text as "transferredAmount",
            (a.amount_centavos-coalesce(p.amount,0))::text as "remainingAmount",
            a.amount_centavos>coalesce(p.amount,0) pending,coalesce(p.transfers,'[]') transfers
           from staytrack.hall_refund_approvals a
           left join lateral (
             select sum(${hallRefundTransferAmount}) amount,
               json_agg(json_build_object('id',coalesce(to_jsonb(t)->>'id',a.id::text),
                 'amount',(${hallRefundTransferAmount})::text,'method',t.method,'reference',t.reference,
                 'transferred_at',t.transferred_at,'evidence',t.evidence) order by t.transferred_at,t.reference) transfers
             from staytrack.hall_refund_transfers t where t.approval_id=a.id
           ) p on true
           where a.reservation_id=r.id) f),'[]') refunds
        from staytrack.hall_reservations r where r.id=$1`,
        [id],
      );
      if (!rows[0]) throw new BookingError("Reservation unavailable.", 404);
      if (await unifiedInstalled(pool)) {
        const allocations = (
          await pool.query(
            `select a.submission_id id,v.verified_by actor,'gcash' method,a.amount_centavos::text amount,v.normalized_reference reference,'Shared online payment allocation' evidence,a.received_at from staytrack.online_payment_allocations a join staytrack.verified_online_payments v on v.submission_id=a.submission_id where a.hall_reservation_id=$1`,
            [id],
          )
        ).rows;
        rows[0].receipts = [...allocations, ...rows[0].receipts];
      }
      res.json(rows[0]);
    }),
  );
  app.get(
    "/staff/hall/commands/:key",
    staff,
    handle(async (req, res) => {
      const { rows } = await pool.query(
        "select action,result,recorded_at from staytrack.hall_actions where actor=$1 and request_key=$2",
        [res.locals.actorId, String(req.params.key)],
      );
      if (!rows[0]) {
        res.status(404).json({
          error: "No committed command found. Retry the original command.",
        });
        return;
      }
      res.json(rows[0]);
    }),
  );
  app.get(
    "/staff/hall/reports",
    staff,
    handle(async (req, res) => {
      res.json(await hallReport(pool, req.query.from, req.query.to));
    }),
  );
  app.post(
    "/staff/hall/actions/:action",
    staff,
    handle(async (req, res) => {
      const action = req.params.action as HallCommand;
      if (!hallCommands.includes(action))
        throw new BookingError("Invalid action.");
      const result = await hallCommand(
        pool,
        res.locals.actorId,
        req.header("Idempotency-Key") ?? "",
        action,
        req.body ?? {},
      );
      res.status(result.issue ? 409 : 200).json(result);
    }),
  );
}
