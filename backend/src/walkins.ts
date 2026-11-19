import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import type { WalkInBooking, WalkInPaymentInput } from "@staytrack/shared";
import { databasePool } from "./database.js";
import {
  BookingError,
  parseBookingItems,
  quoteBooking,
} from "./booking-quote.js";
import {
  claimTransaction,
  createClaimsInTransaction,
} from "./inventory-claims.js";
import { insertBookedItems } from "./booked-items.js";
import { normalizePaymentReference } from "./payment-review.js";
import { hasControlCharacters } from "./payment-media.js";

const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const checkKey = (key: unknown) => {
  if (typeof key !== "string" || !/^[A-Za-z0-9_-]{16,100}$/.test(key))
    throw new BookingError("A valid retry key is required.");
};
const checkId = (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new BookingError("Walk-in not found.", 404);
};
async function activeStaff(client: PoolClient, actorId: string) {
  const staff = await client.query(
    "select auth_user_id from staytrack.staff_accounts where auth_user_id=$1 and active for share",
    [actorId],
  );
  if (staff.rowCount !== 1) throw new BookingError("Staff access denied.", 403);
}
export function walkInBalance(
  charged: number,
  collected: number,
  capacityAvailable = true,
) {
  if (
    !Number.isSafeInteger(charged) ||
    charged < 0 ||
    !Number.isSafeInteger(collected) ||
    collected < 0 ||
    collected > charged
  )
    throw new BookingError("Journal balance requires reconciliation.", 503);
  const minimumCentavos = Math.ceil(charged / 2);
  return {
    totalCentavos: charged,
    collectedCentavos: collected,
    balanceCentavos: charged - collected,
    minimumCentavos,
    paymentMinimumMet: collected >= minimumCentavos,
    normalCheckInEligible: capacityAvailable && collected >= minimumCentavos,
  };
}
export function parseWalkInPayment(value: unknown): WalkInPaymentInput {
  if (!value || typeof value !== "object")
    throw new BookingError("Invalid payment.");
  const input = value as WalkInPaymentInput;
  checkKey(input.requestKey);
  if (
    !["cash", "gcash"].includes(input.method) ||
    !Number.isSafeInteger(input.amountCentavos) ||
    input.amountCentavos <= 0
  )
    throw new BookingError(
      "Enter a positive payment amount in centavos and a supported method.",
    );
  if (input.method === "cash")
    return {
      requestKey: input.requestKey,
      method: "cash",
      amountCentavos: input.amountCentavos,
    };
  const v = input.verification;
  if (
    !v ||
    v.ledgerChecked !== true ||
    v.receivingAccountChecked !== true ||
    v.timeChecked !== true ||
    typeof v.recipient !== "string" ||
    !v.recipient.trim() ||
    v.recipient.trim().length > 120 ||
    hasControlCharacters(v.recipient) ||
    typeof v.receivedAt !== "string" ||
    !/T.*(?:Z|[+-]\d\d:\d\d)$/.test(v.receivedAt) ||
    !Number.isFinite(Date.parse(v.receivedAt))
  )
    throw new BookingError(
      "Verify actual GCash receipt, receiving account, amount, time and reference before recording collected money.",
    );
  return {
    requestKey: input.requestKey,
    method: "gcash",
    amountCentavos: input.amountCentavos,
    verification: {
      reference: normalizePaymentReference(v.reference),
      recipient: v.recipient.trim(),
      receivedAt: new Date(v.receivedAt).toISOString(),
      ledgerChecked: true,
      receivingAccountChecked: true,
      timeChecked: true,
    },
  };
}

async function readWalkIn(
  id: string,
  db: Pick<PoolClient, "query">,
): Promise<WalkInBooking> {
  const { rows } = await db.query<{
    id: string;
    primaryName: string;
    createdAt: Date;
    total_centavos: string;
    items: WalkInBooking["items"];
    ledger: WalkInBooking["ledger"];
    charged: string;
    collected: string;
  }>(
    `select r.id,r.primary_name as "primaryName",r.created_at as "createdAt",r.total_centavos,
    (select json_agg(json_build_object('id',b.id,'category',b.category_code,'startAt',b.start_at,'endAt',b.end_at,
      'totalCentavos',b.total_centavos,'provisionalRoomCode',rm.code,'claimState',i.state) order by b.item_index)
      from staytrack.room_bookings b join staytrack.inventory_claims i on i.id=b.claim_id join staytrack.rooms rm on rm.id=i.room_id where b.reservation_id=r.id) as items,
    coalesce((select json_agg(json_build_object('id',l.id,'kind',l.kind,'method',l.method,'amountCentavos',l.amount_centavos,
      'transactionReference',l.transaction_reference,'actorId',l.actor_auth_user_id,'recordedAt',l.recorded_at,'receivedAt',l.received_at)
      order by l.recorded_at,l.id) from staytrack.walkin_ledger l where l.reservation_id=r.id),'[]'::json) as ledger,
    (select coalesce(sum(amount_centavos),0)::text from staytrack.walkin_ledger where reservation_id=r.id and kind='charge') as charged,
    (select coalesce(sum(amount_centavos),0)::text from staytrack.walkin_ledger where reservation_id=r.id and kind='payment') as collected
    from staytrack.reservations r where r.id=$1 and r.channel='walk_in'`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new BookingError("Walk-in not found.", 404);
  if (row.charged !== row.total_centavos || !row.items?.length)
    throw new BookingError("Journal charges require reconciliation.", 503);
  const { total_centavos, charged, collected, ...record } = row;
  void total_centavos;
  return {
    ...record,
    createdAt: row.createdAt.toISOString(),
    ...walkInBalance(
      Number(charged),
      Number(collected),
      row.items.every((item) => item.claimState === "walkin_reserved"),
    ),
  };
}
export async function walkInBooking(id: string, pool = databasePool()) {
  checkId(id);
  return readWalkIn(id, pool);
}
export async function walkInBookings(pool = databasePool(), page = 0) {
  if (!Number.isSafeInteger(page) || page < 0 || page > 1000000)
    throw new BookingError("Invalid walk-in page.");
  const { rows } = await pool.query<{
    id: string;
    primaryName: string;
    createdAt: Date;
  }>(
    `select id,primary_name as "primaryName",created_at as "createdAt"
    from staytrack.reservations where channel='walk_in' order by created_at desc,id limit 51 offset $1`,
    [page * 50],
  );
  return { bookings: rows.slice(0, 50), hasMore: rows.length > 50 };
}
export async function createWalkInBooking(
  actorId: string,
  key: string,
  primaryName: unknown,
  value: unknown,
  pool = databasePool(),
) {
  checkKey(key);
  if (
    typeof primaryName !== "string" ||
    !primaryName.trim() ||
    primaryName.trim().length > 120 ||
    hasControlCharacters(primaryName)
  )
    throw new BookingError(
      "Enter the primary guest name (up to 120 characters).",
    );
  // Structural validation is time-independent so retries can replay after planned arrival.
  const items = parseBookingItems(value, 0);
  const name = primaryName.trim();
  const requestHash = hash({ items, name });
  const claimKey = hash(`walk_in:${actorId}:${key}`);
  return claimTransaction(async (client) => {
    await activeStaff(client, actorId);
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
      claimKey,
    ]);
    const prior = await client.query<{ id: string; request_hash: string }>(
      "select id,request_hash from staytrack.reservations where idempotency_key=$1 and channel='walk_in' and created_by=$2",
      [claimKey, actorId],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].request_hash !== requestHash)
        throw new BookingError(
          "Retry key was used for a different walk-in.",
          409,
        );
      return {
        booking: await readWalkIn(prior.rows[0].id, client),
        replayed: true,
      };
    }
    const quote = await quoteBooking(items, client);
    const settings = await client.query<{
      cleaning_buffer_minutes: number | null;
    }>(
      "select cleaning_buffer_minutes from staytrack.operational_settings where id=true for share",
    );
    const buffer = settings.rows[0]?.cleaning_buffer_minutes;
    if (buffer === null || buffer === undefined)
      throw new BookingError(
        "Staff must configure the cleaning buffer before reserving capacity.",
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
    await client.query(
      "update staytrack.inventory_claims set state='walkin_reserved' where id=any($1::bigint[])",
      [claims.ids],
    );
    const id = (
      await client.query<{ id: string }>(
        `insert into staytrack.reservations(channel,created_by,owner_auth_user_id,verified_email,primary_name,idempotency_key,request_hash,total_centavos)
      values ('walk_in',$1,null,null,$2,$3,$4,$5) returning id`,
        [actorId, name, claimKey, requestHash, quote.totalCentavos],
      )
    ).rows[0].id;
    await insertBookedItems(client, id, quote, claims.ids);
    const booked = await client.query<{ id: string; total_centavos: string }>(
      "select id,total_centavos from staytrack.room_bookings where reservation_id=$1 order by item_index",
      [id],
    );
    for (const item of booked.rows)
      await client.query(
        `insert into staytrack.walkin_ledger(reservation_id,kind,room_booking_id,amount_centavos,actor_auth_user_id,request_key,request_hash)
      values ($1,'charge',$2,$3,$4,$5,$6)`,
        [
          id,
          item.id,
          item.total_centavos,
          actorId,
          `charge-${item.id}`,
          hash({ itemId: item.id, amount: item.total_centavos }),
        ],
      );
    await client.query(
      "insert into staytrack.staff_audit(actor_auth_user_id,action) values ($1,'walkin.created')",
      [actorId],
    );
    return { booking: await readWalkIn(id, client), replayed: false };
  }, pool);
}
export async function recordWalkInPayment(
  actorId: string,
  id: string,
  value: unknown,
  pool = databasePool(),
) {
  checkId(id);
  const input = parseWalkInPayment(value);
  const requestHash = hash(input);
  try {
    return await claimTransaction(async (client) => {
      await activeStaff(client, actorId);
      const reservation = await client.query(
        "select id from staytrack.reservations where id=$1 and channel='walk_in' for update",
        [id],
      );
      if (!reservation.rowCount)
        throw new BookingError("Walk-in not found.", 404);
      const prior = await client.query<{
        request_hash: string;
        actor_auth_user_id: string;
      }>(
        "select request_hash,actor_auth_user_id from staytrack.walkin_ledger where reservation_id=$1 and request_key=$2",
        [id, input.requestKey],
      );
      if (prior.rows[0]) {
        if (
          prior.rows[0].request_hash !== requestHash ||
          prior.rows[0].actor_auth_user_id !== actorId
        )
          throw new BookingError(
            "Retry key was used for a different payment.",
            409,
          );
        return { booking: await readWalkIn(id, client), replayed: true };
      }
      await client.query(
        `select i.id from staytrack.inventory_claims i
        join staytrack.room_bookings b on b.claim_id=i.id
        where b.reservation_id=$1 order by i.id for update of i`,
        [id],
      );
      const current = await readWalkIn(id, client);
      const departed = current.items.filter(
        (item) => item.claimState !== "walkin_reserved",
      );
      if (departed.length) {
        const installed = (
          await client.query(
            "select to_regclass('staytrack.room_checkouts') is not null as installed",
          )
        ).rows[0].installed;
        const completed =
          installed && departed.every((item) => item.claimState === "released")
            ? await client.query(
                "select room_booking_id from staytrack.room_checkouts where room_booking_id=any($1::uuid[])",
                [departed.map((item) => item.id)],
              )
            : null;
        if (completed?.rowCount !== departed.length)
          throw new BookingError(
            "Capacity requires reconciliation before collecting payment.",
            409,
          );
      }
      if (input.amountCentavos > current.balanceCentavos)
        throw new BookingError("Payment exceeds the remaining balance.", 409);
      const v = input.verification;
      if (v) {
        const qr = (
          await client.query<{ payee_label: string }>(
            "select payee_label from staytrack.payment_qr where id=true for share",
          )
        ).rows[0];
        const now = (
          await client.query<{ now: Date }>("select clock_timestamp() as now")
        ).rows[0].now;
        if (
          !qr ||
          qr.payee_label.trim() !== v.recipient ||
          Date.parse(v.receivedAt) > now.getTime()
        )
          throw new BookingError(
            "GCash recipient or receipt time requires reconciliation.",
            409,
          );
      }
      await client.query(
        `insert into staytrack.walkin_ledger(reservation_id,kind,method,amount_centavos,transaction_reference,normalized_reference,
      recipient,received_at,ledger_checked,receiving_account_checked,time_checked,actor_auth_user_id,request_key,request_hash)
      values ($1,'payment',$2,$3,$4,$4,$5,$6,$7,$7,$7,$8,$9,$10)`,
        [
          id,
          input.method,
          input.amountCentavos,
          v?.reference ?? null,
          v?.recipient ?? null,
          v?.receivedAt ?? null,
          Boolean(v),
          actorId,
          input.requestKey,
          requestHash,
        ],
      );
      await client.query(
        "insert into staytrack.staff_audit(actor_auth_user_id,action) values ($1,$2)",
        [actorId, `walkin.payment.${input.method}`],
      );
      return { booking: await readWalkIn(id, client), replayed: false };
    }, pool);
  } catch (error) {
    if ((error as { code?: string }).code === "23505")
      throw new BookingError(
        "GCash reference was already collected or payment retry conflicts. Reconcile before retrying.",
        409,
      );
    throw error;
  }
}
