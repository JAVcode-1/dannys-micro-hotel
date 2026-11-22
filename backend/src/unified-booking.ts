import type { PoolClient } from "pg";
import type {
  BookingQuote,
  OnlineHallInput,
  OnlineHallItem,
  OnlineHallQuote,
} from "@staytrack/shared";
import { BookingError, quoteBooking } from "./booking-quote.js";
import { quoteInput, hallSettings } from "./hall-reservations.js";
import { quoteHall } from "./hall-scheduling.js";
import { hasControlCharacters } from "./payment-media.js";

type Db = Pick<PoolClient, "query">;
export function unifiedTotal(rooms: number, hall: number) {
  const result = rooms + hall;
  if (![rooms, hall, result].every((v) => Number.isSafeInteger(v) && v >= 0))
    throw new BookingError("Quote exceeds the supported amount.");
  return result;
}
export function parseOnlineHall(value: unknown): OnlineHallInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BookingError("Select a Hall setup and schedule.");
  const input = value as Record<string, unknown>;
  if (input.noticeReason !== undefined)
    throw new BookingError("Short-notice exceptions require staff assistance.");
  const quote = quoteInput(input);
  if (
    input.requests !== undefined &&
    (typeof input.requests !== "string" ||
      input.requests.length > 2000 ||
      hasControlCharacters(input.requests))
  )
    throw new BookingError("Enter additional requests up to 2,000 characters.");
  return {
    ...quote,
    ...(typeof input.requests === "string"
      ? { requests: input.requests.trim() }
      : {}),
  };
}
export function onlineHallCancellationEligible(
  confirmedAt: number | null,
  actualStart: number | null,
  now: number,
) {
  return (
    confirmedAt !== null &&
    actualStart === null &&
    now >= confirmedAt &&
    now < confirmedAt + 3600000
  );
}
export async function unifiedInstalled(db: Db) {
  return (
    (
      await db.query(
        "select to_regclass('staytrack.online_hall_items') is not null as unified_installed",
      )
    ).rows[0]?.unified_installed === true
  );
}
export async function quoteUnified(
  items: unknown,
  hall: unknown,
  db: PoolClient,
): Promise<BookingQuote> {
  if (hall === undefined || hall === null) return quoteBooking(items, db);
  const input = parseOnlineHall(hall);
  const roomQuote =
    Array.isArray(items) && items.length === 0
      ? { items: [], totalCentavos: 0 }
      : await quoteBooking(items, db);
  const now = (await db.query<{ now: Date }>("select clock_timestamp() now"))
    .rows[0].now;
  const settings = await hallSettings(db);
  if (!settings) throw new BookingError("Hall settings are unavailable.", 503);
  const hallQuote = quoteHall(input, settings, +now);
  return {
    ...roomQuote,
    hall: hallQuote,
    totalCentavos: unifiedTotal(roomQuote.totalCentavos, hallQuote.total),
  };
}
export async function hallAvailability(db: Db, quote: OnlineHallQuote) {
  const result = await db.query(
    `select 1 from staytrack.hall_claims where released_at is null
    and tstzrange(preparation_start,cleanup_end,'[)') && tstzrange($1,$2,'[)') limit 1`,
    [quote.protectedStart, quote.protectedEnd],
  );
  return !result.rowCount;
}
export async function insertOnlineHall(
  db: PoolClient,
  reservationId: string,
  name: string,
  input: OnlineHallInput,
  quote: OnlineHallQuote,
) {
  const claim = (
    await db.query<{ id: string }>(
      `insert into staytrack.hall_claims(setup,attendees,event_start,event_end,preparation_start,cleanup_end)
    values($1,$2,$3,$4,$5,$6) returning id`,
      [
        quote.setup,
        quote.attendees,
        quote.start,
        quote.end,
        quote.protectedStart,
        quote.protectedEnd,
      ],
    )
  ).rows[0];
  const hall = (
    await db.query<{ id: string }>(
      `insert into staytrack.hall_reservations(channel,organizer,requests,quote_input,claim_id)
    values('online',$1,$2,$3,$4) returning id`,
      [name, input.requests ?? null, input, claim.id],
    )
  ).rows[0];
  await db.query(
    `insert into staytrack.hall_revisions(reservation_id,claim_id,total_centavos,quote) values($1,$2,$3,$4)`,
    [hall.id, claim.id, quote.total, quote],
  );
  await db.query(
    `insert into staytrack.online_hall_items(reservation_id,hall_reservation_id,original_centavos,proof_deadline_at)
    values($1,$2,$3,now()+interval '30 minutes')`,
    [reservationId, hall.id, quote.total],
  );
  await db.query(
    `insert into staytrack.payment_reminders(reservation_id,minute_offset,due_at)
    select $1,n,now()+n*interval '1 minute' from (values(15),(25)) v(n) on conflict do nothing`,
    [reservationId],
  );
}
export async function onlineHallItems(
  db: Db,
  reservationId: string,
): Promise<OnlineHallItem[]> {
  if (!(await unifiedInstalled(db))) return [];
  return (
    await db.query<OnlineHallItem>(
      `select h.id,q.quote->>'setup' setup,(q.quote->>'attendees')::int attendees,
    q.quote->>'start' "startAt",q.quote->>'end' "endAt",q.total_centavos::float8 "totalCentavos",o.original_centavos::float8 "originalCentavos",
    h.status,o.state,o.proof_deadline_at "proofDeadlineAt",h.actual_start "actualStart",r.online_confirmation_at "confirmationAt",
    coalesce((select sum(a.amount_centavos) from staytrack.hall_refund_approvals a where a.reservation_id=h.id
      and not exists(select 1 from staytrack.hall_refund_transfers t where t.approval_id=a.id)),0)::float8 "refundDueCentavos",
    coalesce((select sum(a.amount_centavos) from staytrack.hall_refund_approvals a join staytrack.hall_refund_transfers t
      on t.approval_id=a.id where a.reservation_id=h.id),0)::float8 "refundedCentavos"
    from staytrack.online_hall_items o join staytrack.hall_reservations h on h.id=o.hall_reservation_id
    join staytrack.reservations r on r.id=o.reservation_id
    join lateral(select quote,total_centavos from staytrack.hall_revisions where reservation_id=h.id order by id desc limit 1) q on true
    where o.reservation_id=$1`,
      [reservationId],
    )
  ).rows;
}
export async function onlineHallState(
  db: Db,
  reservationId: string,
  lock = false,
) {
  if (!(await unifiedInstalled(db))) return [];
  return (
    await db.query<{ state: string; proof_deadline_at: Date; now: Date }>(
      `select o.state,o.proof_deadline_at,clock_timestamp() now
    from staytrack.online_hall_items o where o.reservation_id=$1${lock ? " for update" : ""}`,
      [reservationId],
    )
  ).rows;
}
export async function confirmOnlineHall(db: PoolClient, reservationId: string) {
  const items = await onlineHallState(db, reservationId, true);
  if (!items.length) return false;
  if (items.some((item) => item.state !== "proof_pending_review"))
    throw new BookingError(
      "Hall hold requires manual reconciliation; no items were confirmed.",
      409,
    );
  const valid = await db.query(
    `select 1 from staytrack.online_hall_items o join staytrack.hall_reservations h on h.id=o.hall_reservation_id
    join staytrack.hall_claims c on c.id=h.claim_id where o.reservation_id=$1 and h.status='inquiry' and c.released_at is null and c.event_end>clock_timestamp()`,
    [reservationId],
  );
  if (valid.rowCount !== items.length)
    throw new BookingError(
      "Hall availability changed; reconcile before confirmation.",
      409,
    );
  await db.query(
    "update staytrack.online_hall_items set state='confirmed' where reservation_id=$1",
    [reservationId],
  );
  await db.query(
    "update staytrack.hall_reservations set status='confirmed' where id in(select hall_reservation_id from staytrack.online_hall_items where reservation_id=$1)",
    [reservationId],
  );
  return true;
}
