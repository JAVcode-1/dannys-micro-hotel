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
import { hasControlCharacters } from "./payment-media.js";

export const bookingPolicy = {
  version: "booking-v1",
  text: "No smoking. Online reservations require full payment to the configured hotel GCash account and actual staff verification. Upload both payment proof and reference within 30 minutes; timely submitted proof protects capacity while staff review is pending. An upload does not confirm a reservation. Free cancellation is within one hour after staff confirmation, before that room checks in; rescheduling does not restart the window. Online late arrival does not move checkout. No-shows require staff review and are generally nonrefundable under the disclosed policy and applicable law. Refunds are processed manually. Occupancy guidance is advisory; minor eligibility and legal limits require staff review.",
  pendingOwnerApproval: true,
};
export function parseBookingContact(value: unknown) {
  const contact = value as Record<string, unknown> | null;
  if (
    !contact ||
    typeof contact.phone !== "string" ||
    !/^[+()\d -]{7,30}$/.test(contact.phone.trim()) ||
    (contact.phone.match(/\d/g)?.length ?? 0) < 7 ||
    hasControlCharacters(contact.phone) ||
    contact.policyVersion !== bookingPolicy.version ||
    contact.policyAcknowledged !== true
  )
    throw new BookingError(
      "Enter a contact number and acknowledge the current booking policy.",
    );
  return {
    phone: contact.phone.trim(),
    policyVersion: bookingPolicy.version,
    policyAcknowledged: true as const,
  };
}

// Internal only until inventory, channel, Auth and payment readiness gates pass.
// HTTP creation remains unconditionally disabled in app.ts.
export async function createGuestHold(
  guest: GuestIdentity,
  key: string,
  primaryName: string,
  value: unknown,
  pool = databasePool(),
  chargeDisclosures: unknown = [],
  contactValue?: unknown,
  expectedTotalCentavos?: number,
) {
  if (
    expectedTotalCentavos !== undefined &&
    (!Number.isSafeInteger(expectedTotalCentavos) || expectedTotalCentavos < 0)
  )
    throw new BookingError("Review the current server price before booking.");
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
  const contact =
    contactValue === undefined ? undefined : parseBookingContact(contactValue);
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
        ...(contact ? { contact } : {}),
        ...(expectedTotalCentavos === undefined
          ? {}
          : { expectedTotalCentavos }),
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
    if (
      expectedTotalCentavos !== undefined &&
      quote.totalCentavos !== expectedTotalCentavos
    )
      throw new BookingError(
        "Prices changed. Review a fresh quote before booking.",
        409,
      );
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
    if (contact)
      await client.query(
        `insert into staytrack.reservation_booking_contacts
       (reservation_id,phone,policy_version,policy_text,acknowledged_by)
       values($1,$2,$3,$4,$5)`,
        [
          id,
          contact.phone,
          contact.policyVersion,
          bookingPolicy.text,
          guest.id,
        ],
      );
    return { id, replayed: false };
  }, pool);
}

export async function guestReservations(
  guest: GuestIdentity,
  pool = databasePool(),
  options: { limit?: number; offset?: number; reservationId?: string } = {},
): Promise<GuestReservation[]> {
  const { limit = 20, offset = 0, reservationId } = options;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset > 100000
  )
    throw new BookingError("Invalid reservation pagination.");
  if (
    reservationId &&
    !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(reservationId)
  )
    throw new BookingError("Reservation not found.", 404);
  const schema = (
    await pool.query(
      "select to_regclass('staytrack.stay_item_terms') is not null as installed, to_regclass('staytrack.guest_reviews') is not null as reviews_installed",
    )
  ).rows[0];
  const x03 = schema.installed;
  const { rows } = await pool.query<GuestReservation>(
    `select r.id, r.primary_name as "primaryName",
    r.created_at as "createdAt", r.total_centavos::float8 as "totalCentavos",
    ${schema.reviews_installed ? `(select min(o.checked_out_at) > clock_timestamp()-interval '30 days' and not exists(select 1 from staytrack.guest_reviews gr where gr.reservation_id=r.id) from staytrack.room_bookings rb join staytrack.room_check_ins ci on ci.room_booking_id=rb.id join staytrack.room_checkouts o on o.room_booking_id=rb.id where rb.reservation_id=r.id) as "reviewEligible",` : ""}
    (select json_agg(json_build_object('id', b.id, 'category', b.category_code,
      'status',b.status,${x03 ? "'checkedInAt',(select checked_in_at from staytrack.room_check_ins where room_booking_id=b.id),'checkedOutAt',(select checked_out_at from staytrack.room_checkouts where room_booking_id=b.id)," : ""}
      'startAt', b.start_at, 'endAt', b.end_at, ${x03 ? "'originalCheckoutAt',(select original_checkout_at from staytrack.stay_item_terms where room_booking_id=b.id),'effectiveCheckoutAt',(select effective_checkout_at from staytrack.stay_item_terms where room_booking_id=b.id)," : ""} 'adults', b.adult_count, 'children', b.child_count,
      'totalCentavos', b.total_centavos, 'state', i.state, 'proofDeadlineAt', i.proof_deadline_at,
      'scheduleRevision', coalesce((to_jsonb(b)->>'schedule_revision')::bigint,0),
      'confirmationAt',to_jsonb(r)->>'online_confirmation_at',
      'pendingReschedule',(to_jsonb(b)->>'pending_reschedule_id') is not null,
      'blocks',(select json_agg((p->>'durationMinutes')::integer) from jsonb_array_elements(b.pricing_snapshot) p))
      order by b.item_index) from staytrack.room_bookings b
      join staytrack.inventory_claims i on i.id = b.claim_id where b.reservation_id = r.id) as items
    from staytrack.reservations r where r.owner_auth_user_id = $1 and r.verified_email = $2
    and ($5::uuid is null or r.id=$5::uuid)
    order by r.created_at desc,r.id desc limit $3 offset $4`,
    [guest.id, guest.email.toLowerCase(), limit, offset, reservationId ?? null],
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
