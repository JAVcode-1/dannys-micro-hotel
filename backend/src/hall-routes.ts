import type { Express, RequestHandler } from "express";
import type { Pool } from "pg";
import { BookingError } from "./booking-quote.js";
import {
  hallCommand,
  hallCommands,
  hallSettings,
  quoteInput,
  type HallCommand,
} from "./hall-reservations.js";
import { quoteHall } from "./hall-scheduling.js";
import { hallReport } from "./hall-reports.js";

export function registerHall(app: Express, staff: RequestHandler, pool?: Pool) {
  if (!pool) return;
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
    "/staff/hall/settings",
    staff,
    handle(async (_req, res) => {
      res.json(await hallSettings(pool));
    }),
  );
  app.post(
    "/staff/hall/quote",
    staff,
    handle(async (req, res) => {
      const {
        rows: [clock],
      } = await pool.query<{ now: Date }>("select clock_timestamp() now");
      const quote = quoteHall(
        quoteInput(req.body ?? {}),
        await hallSettings(pool),
        +clock.now,
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
      const { rows } = await pool.query(
        `select r.id,r.claim_id,r.channel,r.organizer,r.requests,r.status,r.payment_resolution,r.actual_start,r.actual_end,
      r.quote_input, q.quote,c.released_at,h.ready,
      (r.status='confirmed' and c.preparation_start<=clock_timestamp() and exists(
        select 1 from staytrack.hall_reservations occupied where occupied.status='in_progress' and occupied.id<>r.id
      )) preparation_conflict,
      coalesce(q.total_centavos,0)::text total,
      coalesce(o.amount_centavos,0)::text overtime,
      coalesce(p.amount,0)::text collected,coalesce(f.amount,0)::text refunded,
      greatest(0,coalesce(q.total_centavos,0)+coalesce(o.amount_centavos,0)-coalesce(p.amount,0)+coalesce(f.amount,0))::text balance
      from staytrack.hall_reservations r cross join staytrack.hall_resource h
      left join staytrack.hall_claims c on c.id=r.claim_id
      left join lateral(select quote,total_centavos from staytrack.hall_revisions where reservation_id=r.id order by id desc limit 1) q on true
      left join lateral(select sum(amount_centavos) amount from staytrack.hall_receipts where reservation_id=r.id) p on true
      left join lateral(select sum(a.amount_centavos) amount from staytrack.hall_refund_approvals a
        join staytrack.hall_refund_transfers t on t.approval_id=a.id where a.reservation_id=r.id) f on true
      left join staytrack.hall_overtime_charges o on o.reservation_id=r.id
      order by coalesce(c.event_start,r.created_at) desc,r.id limit 50 offset $1`,
        [(page - 1) * 50],
      );
      res.json({ entries: rows });
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
