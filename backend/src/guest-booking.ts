import { readStayFinancials } from "./stay-finance.js";
import {
  captureChargeDisclosures,
  parseChargeDisclosures,
} from "./stay-disclosures.js";
import { createHash } from "node:crypto";
import type { GuestReservation } from "@staytrack/shared";
import type { GuestIdentity } from "./guest-auth.js";
import {
  BookingError,
  parseBookingItems,
  quoteBooking,
} from "./booking-quote.js";
import {
  claimTransaction,
  createClaimsInTransaction,
} from "./inventory-claims.js";
import { databasePool } from "./database.js";
import { insertBookedItems } from "./booked-items.js";

// Internal only until inventory, channel, Auth and payment readiness gates pass.
// HTTP creation remains unconditionally disabled in app.ts.
export async function createGuestHold(
  guest: GuestIdentity,
  key: string,
  primaryName: string,
  value: unknown,
  pool = databasePool(),
  chargeDisclosures: unknown = [],
) {
  if (
    !/^[A-Za-z0-9_-]{16,100}$/.test(key) ||
    !/^[0-9a-f-]{36}$/i.test(guest.id) ||
    !guest.email ||
    typeof primaryName !== "string" ||
    !primaryName.trim() ||
    primaryName.trim().length > 120
  )
    throw new BookingError("Invalid booking contact or request key.");
  const disclosures = parseChargeDisclosures(chargeDisclosures);
  const items = parseBookingItems(value);
  const name = primaryName.trim();
  const email = guest.email.toLowerCase();
  const requestHash = createHash("sha256")
    .update(
      JSON.stringify({
        items,
        name,
        email,
        ...(disclosures.length ? { disclosures } : {}),
      }),
    )
    .digest("hex");
  // Scope request keys to the authenticated identity; never expose raw claim keys.
  const claimKey = createHash("sha256")
    .update(`${guest.id}:${key}`)
    .digest("hex");
  return claimTransaction(async (client) => {
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [claimKey],
    );
    const prior = await client.query<{ id: string; request_hash: string }>(
      "select id, request_hash from staytrack.reservations where idempotency_key = $1 and owner_auth_user_id = $2",
      [claimKey, guest.id],
    );
    if (prior.rowCount) {
      if (prior.rows[0].request_hash !== requestHash)
        throw new BookingError(
          "Request key was already used for a different booking.",
          409,
        );
      return { id: prior.rows[0].id, replayed: true };
    }
    const quote = await quoteBooking(items, client);
    const settings = await client.query<{
      cleaning_buffer_minutes: number | null;
    }>(
      "select cleaning_buffer_minutes from staytrack.operational_settings where id = true for share",
    );
    const buffer = settings.rows[0]?.cleaning_buffer_minutes;
    if (buffer === null || buffer === undefined)
      throw new BookingError(
        "Staff must configure the cleaning buffer before holds can be created.",
        503,
      );
    const claims = await createClaimsInTransaction(
      claimKey,
      quote.items.map((item) => ({
        category: item.category,
        start: Date.parse(item.startAt),
        end: Date.parse(item.endAt),
        bufferMinutes: buffer,
      })),
      client,
    );
    if (claims.status !== "created")
      throw new BookingError(
        "The selected rooms are no longer available.",
        409,
      );
    const reservation = await client.query<{ id: string }>(
      `insert into staytrack.reservations(owner_auth_user_id, verified_email, primary_name, idempotency_key, request_hash, total_centavos)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [guest.id, email, name, claimKey, requestHash, quote.totalCentavos],
    );
    const id = reservation.rows[0].id;
    await insertBookedItems(client, id, quote, claims.ids);
    await captureChargeDisclosures(client, id, disclosures);
    return { id, replayed: false };
  }, pool);
}

export async function guestReservations(
  guest: GuestIdentity,
  pool = databasePool(),
): Promise<GuestReservation[]> {
  const x03 = (
    await pool.query(
      "select to_regclass('staytrack.stay_item_terms') is not null as installed",
    )
  ).rows[0].installed;
  const { rows } = await pool.query<GuestReservation>(
    `select r.id, r.primary_name as "primaryName",
    r.created_at as "createdAt", r.total_centavos::float8 as "totalCentavos",
    (select json_agg(json_build_object('id', b.id, 'category', b.category_code,
      'startAt', b.start_at, 'endAt', b.end_at, ${x03 ? "'originalCheckoutAt',(select original_checkout_at from staytrack.stay_item_terms where room_booking_id=b.id),'effectiveCheckoutAt',(select effective_checkout_at from staytrack.stay_item_terms where room_booking_id=b.id)," : ""} 'adults', b.adult_count, 'children', b.child_count,
      'totalCentavos', b.total_centavos, 'state', i.state, 'proofDeadlineAt', i.proof_deadline_at,
      'scheduleRevision', coalesce((to_jsonb(b)->>'schedule_revision')::bigint,0),
      'confirmationAt',to_jsonb(r)->>'online_confirmation_at',
      'pendingReschedule',(to_jsonb(b)->>'pending_reschedule_id') is not null,
      'blocks',(select json_agg((p->>'durationMinutes')::integer) from jsonb_array_elements(b.pricing_snapshot) p))
      order by b.item_index) from staytrack.room_bookings b
      join staytrack.inventory_claims i on i.id = b.claim_id where b.reservation_id = r.id) as items
    from staytrack.reservations r where r.owner_auth_user_id = $1 and r.verified_email = $2
    order by r.created_at desc limit 50`,
    [guest.id, guest.email.toLowerCase()],
  );
  if (x03)
    for (const r of rows) {
      r.financials = await readStayFinancials(pool, r.id);
      for (const item of r.items)
        item.additionalCharges = (
          await pool.query(
            `select e.kind,e.amount_centavos::float8 as "amountCentavos",coalesce(a.amount,0)::float8 as "paidCentavos",coalesce(c.amount,0)::float8 as "creditedCentavos" from staytrack.stay_charge_entries e left join lateral(select sum(amount_centavos) as amount from staytrack.stay_active_allocations where charge_id=e.id or (e.extension_request_id is not null and extension_request_id=e.extension_request_id)) a on true left join lateral(select sum(amount_centavos) as amount from staytrack.stay_charge_entries where credit_of=e.id) c on true where e.room_booking_id=$1 and e.kind in ('extension_debit','overtime_debit','smoking_debit') order by e.recorded_at`,
            [item.id],
          )
        ).rows;
    }
  return rows;
}
