import {
  onlineHallItems,
  confirmOnlineHall,
  unifiedInstalled,
} from "./unified-booking.js";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { PaymentReviewInput, StaffPaymentReview } from "@staytrack/shared";
import { databasePool } from "./database.js";
import { BookingError } from "./booking-quote.js";
import { claimTransaction } from "./inventory-claims.js";
import { allocateRooms } from "./availability.js";
import { reviewAge } from "./claim-holds.js";
import {
  hasControlCharacters,
  paymentMediaStore,
  PROOF_BUCKET,
  validateReference,
} from "./payment-media.js";
import type { PaymentMediaStore } from "./payment-media.js";

export function normalizePaymentReference(value: unknown) {
  const reference = validateReference(value);
  if (!/^[a-zA-Z0-9 -]+$/.test(reference) || !/[a-zA-Z0-9]/.test(reference))
    throw new BookingError(
      "Use the transaction reference from the receiving account, with letters, numbers, spaces or hyphens only.",
    );
  return reference.replace(/[ -]/g, "").toUpperCase();
}
const checkId = (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new BookingError("Payment review not found.", 404);
};
export function parsePaymentDecision(value: unknown): PaymentReviewInput {
  if (!value || typeof value !== "object")
    throw new BookingError("Invalid review decision.");
  const input = value as PaymentReviewInput;
  if (
    ![
      "confirmed",
      "rejected",
      "mismatched",
      "unresolved",
      "late_reconciliation",
    ].includes(input.decision) ||
    !Number.isSafeInteger(input.expectedVersion) ||
    input.expectedVersion < 0 ||
    typeof input.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(input.requestKey) ||
    typeof input.note !== "string" ||
    !input.note.trim() ||
    input.note.trim().length > 1000 ||
    hasControlCharacters(input.note)
  )
    throw new BookingError(
      "Choose a decision and enter a review note with a fresh request key and current version.",
    );
  let verification: PaymentReviewInput["verification"];
  if (input.decision === "confirmed") {
    const v = input.verification;
    if (
      !v ||
      v.ledgerChecked !== true ||
      v.receivingAccountChecked !== true ||
      v.timeChecked !== true ||
      !Number.isSafeInteger(v.amountCentavos) ||
      v.amountCentavos < 0 ||
      typeof v.recipient !== "string" ||
      !v.recipient.trim() ||
      v.recipient.trim().length > 120 ||
      hasControlCharacters(v.recipient) ||
      typeof v.receivedAt !== "string" ||
      !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v.receivedAt) ||
      !Number.isFinite(Date.parse(v.receivedAt))
    )
      throw new BookingError(
        "Manually check the actual receiving GCash account, amount, recipient, time and reference before confirming.",
      );
    verification = {
      ledgerChecked: true,
      receivingAccountChecked: true,
      timeChecked: true,
      reference: normalizePaymentReference(v.reference),
      recipient: v.recipient.trim(),
      amountCentavos: v.amountCentavos,
      receivedAt: new Date(v.receivedAt).toISOString(),
    };
  }
  return {
    decision: input.decision,
    expectedVersion: input.expectedVersion,
    requestKey: input.requestKey,
    note: input.note.trim(),
    ...(verification ? { verification } : {}),
  };
}

export async function staffPaymentReviews(
  pool = databasePool(),
  page = 0,
): Promise<StaffPaymentReview[]> {
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000000)
    throw new BookingError("Invalid review page.");
  // Preserve O03 on the eight-migration schema while W01 is awaiting approval.
  const registry =
    (
      await pool.query<{ exists: boolean }>(
        "select to_regclass('staytrack.gcash_reference_registry') is not null as exists",
      )
    ).rows[0]?.exists === true;
  const duplicateSource = registry
    ? "staytrack.gcash_reference_registry v where v.online_submission_id is distinct from p.id"
    : "staytrack.verified_online_payments v where v.submission_id <> p.id";
  const { rows } = await pool.query<
    Omit<StaffPaymentReview, "age" | "submittedAt"> & {
      submittedAt: Date;
      serverNow: Date;
    }
  >(
    `select p.id, p.reservation_id as "reservationId", r.primary_name as "primaryName",
    p.transaction_reference as "transactionReference", r.total_centavos::float8 as "amountDueCentavos",
    p.submitted_at as "submittedAt", clock_timestamp() as "serverNow", p.status, p.review_version as version,
    (select json_build_object('note',pr.note,'actorId',pr.actor_auth_user_id,'createdAt',pr.created_at)
      from staytrack.payment_reviews pr where pr.submission_id=p.id order by pr.version desc limit 1) as "lastReview",
    exists(select 1 from ${duplicateSource}
      and v.normalized_reference = upper(regexp_replace(p.transaction_reference, '[ -]', '', 'g'))) as "duplicateReference",
    (select json_agg(json_build_object('category',b.category_code,'startAt',b.start_at,'endAt',b.end_at,
      'totalCentavos',b.total_centavos) order by b.item_index) from staytrack.room_bookings b where b.reservation_id=r.id) as items
    from staytrack.payment_submissions p join staytrack.reservations r on r.id=p.reservation_id
    order by (p.status = 'pending_review') desc, (p.status <> 'confirmed') desc, p.submitted_at, p.id limit 101 offset $1`,
    [page * 100],
  );
  for (const row of rows) {
    row.items ??= [];
    row.hallItems = await onlineHallItems(pool, row.reservationId);
    row.serviceKind = row.hallItems.length
      ? row.items.length
        ? "combined"
        : "hall"
      : "accommodation";
  }
  return rows.map(({ serverNow, submittedAt, ...row }) => ({
    ...row,
    submittedAt: submittedAt.toISOString(),
    age: reviewAge(
      submittedAt.getTime(),
      Math.max(serverNow.getTime(), submittedAt.getTime()),
    ),
  }));
}

export async function staffProofUrl(
  actorId: string,
  id: string,
  pool = databasePool(),
  store: PaymentMediaStore = paymentMediaStore(),
) {
  checkId(id);
  const { rows } = await pool.query<{ object_key: string }>(
    "select object_key from staytrack.payment_submissions where id = $1",
    [id],
  );
  if (!rows[0]) throw new BookingError("Payment review not found.", 404);
  // Record access before issuing a bearer link; never log the private key or URL.
  await pool.query(
    "insert into staytrack.staff_audit(actor_auth_user_id, action) values ($1, 'payment.proof_viewed')",
    [actorId],
  );
  return {
    url: await store.signedUrl(PROOF_BUCKET, rows[0].object_key),
    expiresIn: 120,
  };
}

async function checkConfirmationCapacity(
  client: PoolClient,
  reservationId: string,
) {
  const categories = await client.query<{ id: string }>(
    `select distinct i.category_id as id from staytrack.inventory_claims i
    join staytrack.room_bookings b on b.claim_id=i.id where b.reservation_id=$1 order by id`,
    [reservationId],
  );
  for (const row of categories.rows)
    await client.query("select pg_advisory_xact_lock($1::bigint)", [row.id]);
  const cart = await client.query<{
    id: string;
    category: string;
    room_id: string;
    start_at: Date;
    end_at: Date;
    buffer_minutes: number;
    state: string;
    status: string;
    item_start: Date;
    item_end: Date;
    item_category: string;
  }>(
    `select i.*, c.code as category, b.status, b.start_at as item_start, b.end_at as item_end, b.category_code as item_category
     from staytrack.inventory_claims i join staytrack.room_bookings b on b.claim_id=i.id
     join staytrack.room_categories c on c.id=i.category_id where b.reservation_id=$1 order by i.id for update of i,b`,
    [reservationId],
  );
  if (!cart.rowCount && (await onlineHallItems(client, reservationId)).length)
    return;
  if (
    !cart.rowCount ||
    cart.rows.some(
      (row) =>
        row.state !== "proof_pending_review" ||
        row.status !== "pending" ||
        row.start_at.getTime() !== row.item_start.getTime() ||
        row.end_at.getTime() !== row.item_end.getTime() ||
        row.category !== row.item_category,
    )
  )
    throw new BookingError(
      "Claims require manual reconciliation; no items were confirmed.",
      409,
    );
  const rooms = await client.query<{
    id: string;
    category: string;
    operational_state: string;
  }>(
    `select r.id,c.code as category,r.operational_state from staytrack.rooms r join staytrack.room_categories c on c.id=r.category_id
     where r.active and c.active and c.id=any($1::bigint[]) order by r.id for share of r,c`,
    [categories.rows.map((row) => row.id)],
  );
  const firstStart = new Date(
    Math.min(...cart.rows.map((row) => row.start_at.getTime())),
  );
  const lastEnd = new Date(
    Math.max(
      ...cart.rows.map(
        (row) => row.end_at.getTime() + row.buffer_minutes * 60000,
      ),
    ),
  );
  const blocks = await client.query<{
    room_id: string;
    start_at: Date;
    end_at: Date | null;
  }>(
    "select room_id,start_at,end_at from staytrack.room_blocks where room_id=any($1::bigint[]) and start_at<$3 and (end_at is null or end_at>$2)",
    [rooms.rows.map((row) => row.id), firstStart, lastEnd],
  );
  const others = await client.query<{
    id: string;
    category: string;
    room_id: string;
    start_at: Date;
    end_at: Date;
    buffer_minutes: number;
  }>(
    `select i.*,c.code as category from staytrack.inventory_claims i join staytrack.room_categories c on c.id=i.category_id
     where i.category_id=any($1::bigint[]) and i.state not in ('released','expired') and not (i.id=any($2::bigint[])) and i.start_at<$4 and i.buffered_end_at>$3`,
    [
      categories.rows.map((row) => row.id),
      cart.rows.map((row) => row.id),
      firstStart,
      lastEnd,
    ],
  );
  const occupancy = (row: (typeof others.rows)[number]) => ({
    id: row.id,
    category: row.category,
    roomId: Number(row.room_id),
    start: row.start_at.getTime(),
    end: row.end_at.getTime(),
    bufferMinutes: row.buffer_minutes,
  });
  const now = (
    await client.query<{ now: Date }>("select clock_timestamp() as now")
  ).rows[0].now.getTime();
  if (
    cart.rows.some((row) => row.end_at.getTime() <= now) ||
    !allocateRooms(
      rooms.rows.map((row) => ({
        id: Number(row.id),
        category: row.category,
        ready: row.operational_state === "ready",
      })),
      others.rows.map(occupancy),
      blocks.rows.map((row) => ({
        roomId: Number(row.room_id),
        start: row.start_at.getTime(),
        end: row.end_at?.getTime() ?? null,
      })),
      cart.rows.map(occupancy),
      now,
    )
  )
    throw new BookingError(
      "Availability changed or a stay has ended. Reconcile with the guest; no items were confirmed.",
      409,
    );
}

export async function decidePaymentReview(
  actorId: string,
  id: string,
  value: unknown,
  pool = databasePool(),
) {
  checkId(id);
  const input = parsePaymentDecision(value);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  try {
    return await claimTransaction(async (client) => {
      // Recheck active membership inside the money transaction, including direct internal callers.
      const staff = await client.query(
        "select auth_user_id from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [actorId],
      );
      if (staff.rowCount !== 1)
        throw new BookingError("Staff access denied.", 403);
      if (await unifiedInstalled(client))
        await client.query(
          "select id from staytrack.hall_resource where id=1 for update",
        );
      const initial = await client.query<{ reservation_id: string }>(
        "select reservation_id from staytrack.payment_submissions where id=$1",
        [id],
      );
      if (!initial.rows[0])
        throw new BookingError("Payment review not found.", 404);
      const reservationId = initial.rows[0].reservation_id;
      const reservation = (
        await client.query<{
          total_centavos: string;
          verified_email: string;
          online_confirmation_at: Date | null;
        }>(
          "select total_centavos,verified_email,online_confirmation_at from staytrack.reservations where id=$1 for update",
          [reservationId],
        )
      ).rows[0];
      const submission = (
        await client.query<{
          status: string;
          review_version: number;
          transaction_reference: string;
          amount_due_centavos: string;
          submitted_at: Date;
        }>(
          "select * from staytrack.payment_submissions where id=$1 for update",
          [id],
        )
      ).rows[0];
      const prior = await client.query<{
        request_hash: string;
        actor_auth_user_id: string;
        decision: string;
        version: number;
      }>(
        "select request_hash,actor_auth_user_id,decision,version from staytrack.payment_reviews where submission_id=$1 and request_key=$2",
        [id, input.requestKey],
      );
      if (prior.rows[0]) {
        if (
          prior.rows[0].request_hash !== hash ||
          prior.rows[0].actor_auth_user_id !== actorId
        )
          throw new BookingError(
            "Request key already used for another decision.",
            409,
          );
        return {
          status: prior.rows[0].decision,
          version: prior.rows[0].version,
          replayed: true,
        };
      }
      if (
        submission.review_version !== input.expectedVersion ||
        submission.status === "confirmed" ||
        reservation.online_confirmation_at
      )
        throw new BookingError(
          "Review changed or is already confirmed. Refresh before deciding.",
          409,
        );
      if (input.decision === "confirmed") {
        const v = input.verification!;
        if (
          v.reference !==
            normalizePaymentReference(submission.transaction_reference) ||
          v.amountCentavos !== Number(reservation.total_centavos) ||
          submission.amount_due_centavos !== reservation.total_centavos
        )
          throw new BookingError(
            "Reference or full booked amount does not match. Record a mismatch for reconciliation.",
            409,
          );
        const now = (
          await client.query<{ now: Date }>("select clock_timestamp() as now")
        ).rows[0].now;
        if (
          Date.parse(v.receivedAt) > now.getTime() ||
          Date.parse(v.receivedAt) > submission.submitted_at.getTime()
        )
          throw new BookingError(
            "Receiving-account time does not match the submitted proof.",
            409,
          );
        const qr = await client.query<{ payee_label: string }>(
          "select payee_label from staytrack.payment_qr where id=true for share",
        );
        if (!qr.rows[0] || qr.rows[0].payee_label.trim() !== v.recipient)
          throw new BookingError(
            "Verify the configured hotel receiving account; recipient mismatch requires reconciliation.",
            409,
          );
        await confirmOnlineHall(client, reservationId);
        await checkConfirmationCapacity(client, reservationId);
        const terms = (
          await client.query<{ cancellation_display_text: string | null }>(
            "select cancellation_display_text from staytrack.operational_settings where id=true for share",
          )
        ).rows[0]?.cancellation_display_text?.trim();
        if (!terms)
          throw new BookingError(
            "Staff must configure approved cancellation terms before confirmation.",
            503,
          );
        await client.query(
          `insert into staytrack.verified_online_payments(submission_id,normalized_reference,amount_centavos,recipient,received_at,verified_by)
          values ($1,$2,$3,$4,$5,$6)`,
          [
            id,
            v.reference,
            v.amountCentavos,
            v.recipient,
            v.receivedAt,
            actorId,
          ],
        );
        await client.query(
          "update staytrack.reservations set online_confirmation_at=clock_timestamp(), cancellation_terms_snapshot=$2 where id=$1",
          [reservationId, terms],
        );
        await client.query(
          "update staytrack.inventory_claims set state='confirmed' where id in (select claim_id from staytrack.room_bookings where reservation_id=$1)",
          [reservationId],
        );
        await client.query(
          "update staytrack.room_bookings set status='confirmed' where reservation_id=$1",
          [reservationId],
        );
      }
      const version = submission.review_version + 1;
      const review = (
        await client.query<{ id: string }>(
          `insert into staytrack.payment_reviews(submission_id,version,request_key,request_hash,decision,note,actor_auth_user_id,evidence)
        values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) returning id`,
          [
            id,
            version,
            input.requestKey,
            hash,
            input.decision,
            input.note,
            actorId,
            JSON.stringify(input.verification ?? {}),
          ],
        )
      ).rows[0];
      await client.query(
        "update staytrack.payment_submissions set status=$2,review_version=$3 where id=$1",
        [id, input.decision, version],
      );
      await client.query(
        "insert into staytrack.staff_audit(actor_auth_user_id,action) values ($1,$2)",
        [actorId, `payment.review.${input.decision}`],
      );
      const hallItems = await onlineHallItems(client, reservationId);
      // The notification snapshot commits with the staff decision, never with proof upload.
      const snapshot = await client.query(
        `insert into staytrack.payment_notification_outbox(review_id,reservation_id,recipient_email,payload)
        select $1,r.id,r.verified_email,jsonb_build_object('reservationId',r.id,'decision',$3::text,'onlineConfirmationAt',r.online_confirmation_at,
          'cancellationTerms',r.cancellation_terms_snapshot,'amountCentavos',r.total_centavos,
          'hallItems',$4::jsonb,
          'items',(select jsonb_agg(jsonb_build_object('id',b.id,'category',b.category_code,'packages',b.pricing_snapshot,'startAt',b.start_at,'endAt',b.end_at,'totalCentavos',b.total_centavos) order by b.item_index)
          from staytrack.room_bookings b where b.reservation_id=r.id)) from staytrack.reservations r where r.id=$2 returning payload,recipient_email`,
        [review.id, reservationId, input.decision, JSON.stringify(hallItems)],
      );
      if (input.decision === "confirmed" && await unifiedInstalled(client)) {
        await client.query(`insert into staytrack.notification_outbox(dedupe_key,recipient,kind,reservation_id,payload)
          values($1,$2,'reservation_confirmed',$3,$4::jsonb)
          on conflict(dedupe_key) do update set payload=excluded.payload where staytrack.notification_outbox.state='pending'`,
          [`reservation_confirmed:${reservationId}`, snapshot.rows[0].recipient_email, reservationId, JSON.stringify(snapshot.rows[0].payload)]);
      }
      return { status: input.decision, version, replayed: false };
    }, pool);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new BookingError(
        "Reference was already verified or review changed. Refresh and reconcile; no duplicate confirmation was made.",
        409,
      );
    throw error;
  }
}
