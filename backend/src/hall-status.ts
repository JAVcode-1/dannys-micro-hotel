import type { PoolClient } from "pg";
import { BookingError } from "./booking-quote.js";

export async function readHallStatus(db: Pick<PoolClient, "query">) {
  const {
    rows: [hall],
  } = await db.query<{
    ready: boolean;
    occupied: boolean;
    reserved: boolean;
    reservedUntil: Date | null;
    maintenanceEnabled: boolean;
    outOfServiceId: string | null;
    outOfServiceUntil: Date | null;
  }>(`
    select h.ready, exists (
      select 1 from staytrack.hall_reservations where status='in_progress'
    ) as occupied,
    coalesce(c.purpose='event', false) as reserved,
    case when c.purpose='event' then c.cleanup_end end as "reservedUntil",
    case when c.purpose='out_of_service' then c.id end as "outOfServiceId",
    case when c.purpose='out_of_service' then c.event_end end as "outOfServiceUntil",
    exists (
      select 1 from pg_attribute
      where attrelid='staytrack.hall_claims'::regclass
      and attname='purpose' and not attisdropped
    ) as "maintenanceEnabled"
    from staytrack.hall_resource h
    left join lateral (
      select claim.id, claim.event_end, claim.cleanup_end,
        coalesce(to_jsonb(claim)->>'purpose', 'event') as purpose
      from staytrack.hall_claims claim
      where claim.resource_id=h.id and claim.released_at is null
        and tstzrange(claim.preparation_start,claim.cleanup_end,'[)') @> statement_timestamp()
      limit 1
    ) c on true
    where h.id=1
  `);
  if (!hall)
    throw new BookingError("Function Hall status is unavailable.", 503);
  return hall;
}
