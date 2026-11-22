import type { PoolClient } from "pg";
import { createHash } from "node:crypto";
import { databasePool } from "./database.js";
import {
  allocateRooms,
  type Occupancy,
  type Room,
  type RoomBlock,
} from "./availability.js";

export type ClaimItem = Pick<
  Occupancy,
  "category" | "start" | "end" | "bufferMinutes"
>;
type ClaimResult = {
  status: "created" | "replayed" | "unavailable";
  ids: number[];
  reason?: string;
};

const instant = (value: number) => new Date(value).toISOString();
const millis = (value: Date) => value.getTime();
const safeId = (value: string | number) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1)
    throw new Error("Database ID exceeds safe integer range");
  return id;
};

export async function createClaimsInTransaction(
  key: string,
  items: ClaimItem[],
  client: PoolClient,
  availabilityOnly = false,
): Promise<ClaimResult> {
  if (
    !/^[A-Za-z0-9_-]{16,128}$/.test(key) ||
    items.length === 0 ||
    items.length > 15 ||
    items.some(
      (item) =>
        !["double_standard", "family_executive"].includes(item.category) ||
        !Number.isSafeInteger(item.start) ||
        !Number.isSafeInteger(item.end) ||
        item.start >= item.end ||
        !Number.isSafeInteger(item.bufferMinutes) ||
        item.bufferMinutes < 0 ||
        item.bufferMinutes > 1440 ||
        !Number.isSafeInteger(item.end + item.bufferMinutes * 60000) ||
        !Number.isFinite(new Date(item.start).getTime()) ||
        !Number.isFinite(
          new Date(item.end + item.bufferMinutes * 60000).getTime(),
        ),
    )
  )
    throw new Error("Invalid claim request");
  const hash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  await client.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    key,
  ]);
  const prior = await client.query<{ request_hash: string }>(
    "select request_hash from staytrack.claim_requests where idempotency_key = $1",
    [key],
  );
  if (prior.rowCount) {
    if (prior.rows[0].request_hash !== hash)
      throw new Error("Idempotency key reused with different request");
    const result = await client.query<{ id: string }>(
      "select id from staytrack.inventory_claims where idempotency_key = $1 order by item_index",
      [key],
    );
    return {
      status: "replayed",
      ids: result.rows.map((row) => safeId(row.id)),
    };
  }

  const categories = await client.query<{ id: string; code: string }>(
    "select id, code from staytrack.room_categories where code = any($1::text[]) and active order by id",
    [Array.from(new Set(items.map((item) => item.category)))],
  );
  if (
    categories.rowCount !== new Set(items.map((item) => item.category)).size
  ) {
    return { status: "unavailable", ids: [], reason: "A selected room category is not currently offered for booking. Please contact the hotel." };
  }
  for (const category of categories.rows)
    await client.query("select pg_advisory_xact_lock($1::bigint)", [
      safeId(category.id),
    ]);

  const roomRows = await client.query<{
    id: string;
    category: string;
    operational_state: string;
    active: boolean;
  }>(
    `select r.id, c.code as category, r.operational_state, r.active
       from staytrack.rooms r join staytrack.room_categories c on c.id = r.category_id
       where c.code = any($1::text[]) order by r.id`,
    [categories.rows.map((row) => row.code)],
  );
  for (const category of categories.rows) {
    const registered = roomRows.rows.filter(row => row.category === category.code);
    const label = category.code === "double_standard" ? "Double Standard" : "Family Executive";
    if (!registered.length)
      return { status: "unavailable", ids: [], reason: `No physical rooms are registered for ${label} yet. Please contact the hotel.` };
    if (!registered.some(row => row.active))
      return { status: "unavailable", ids: [], reason: `No ${label} rooms are currently active for booking. Please contact the hotel.` };
  }
  const rooms: Room[] = roomRows.rows.filter(row => row.active).map((row) => ({
    id: safeId(row.id),
    category: row.category,
    ready: row.operational_state === "ready",
  }));
  const firstStart = instant(Math.min(...items.map((item) => item.start)));
  const lastEnd = instant(
    Math.max(...items.map((item) => item.end + item.bufferMinutes * 60000)),
  );
  const priorClaims = await client.query<{
    id: string;
    category: string;
    room_id: string;
    start_at: Date;
    end_at: Date;
    buffer_minutes: number;
  }>(
    `select i.id, c.code as category, i.room_id, i.start_at, i.end_at, i.buffer_minutes
       from staytrack.inventory_claims i join staytrack.room_categories c on c.id = i.category_id
       where i.state not in ('released', 'expired') and c.code = any($1::text[])
       and i.start_at<$3 and i.buffered_end_at>$2`,
    [categories.rows.map((row) => row.code), firstStart, lastEnd],
  );
  const existing: Occupancy[] = priorClaims.rows.map((row) => ({
    id: String(row.id),
    category: row.category,
    roomId: safeId(row.room_id),
    start: millis(row.start_at),
    end: millis(row.end_at),
    bufferMinutes: row.buffer_minutes,
  }));
  const blockRows = await client.query<{
    room_id: string;
    start_at: Date;
    end_at: Date | null;
  }>(
    `select b.room_id, b.start_at, b.end_at from staytrack.room_blocks b
       join staytrack.rooms r on r.id = b.room_id join staytrack.room_categories c on c.id = r.category_id
       where r.active and c.code = any($1::text[]) and b.start_at<$3 and (b.end_at is null or b.end_at>$2)`,
    [categories.rows.map((row) => row.code), firstStart, lastEnd],
  );
  const blocks: RoomBlock[] = blockRows.rows.map((row) => ({
    roomId: safeId(row.room_id),
    start: millis(row.start_at),
    end: row.end_at ? millis(row.end_at) : null,
  }));
  const cart: Occupancy[] = items.map((item, index) => ({
    ...item,
    id: String(index),
    roomId: null,
  }));
  const assignment = allocateRooms(rooms, existing, blocks, cart);
  if (!assignment) {
    return { status: "unavailable", ids: [], reason: "No rooms are available for all selected schedules, including required cleaning and maintenance time. Choose another schedule or contact the hotel." };
  }

  if (availabilityOnly) return { status: "created", ids: [] };

  await client.query(
    "insert into staytrack.claim_requests(idempotency_key, request_hash) values ($1, $2)",
    [key, hash],
  );
  const ids: number[] = [];
  for (const [index, item] of items.entries()) {
    const categoryId = categories.rows.find(
      (row) => row.code === item.category,
    )!.id;
    const result = await client.query<{ id: string }>(
      `insert into staytrack.inventory_claims
         (idempotency_key, item_index, category_id, room_id, start_at, end_at, buffer_minutes, buffered_end_at, state, proof_deadline_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'held', now() + interval '30 minutes') returning id`,
      [
        key,
        index,
        safeId(categoryId),
        assignment[index],
        instant(item.start),
        instant(item.end),
        item.bufferMinutes,
        instant(item.end + item.bufferMinutes * 60000),
      ],
    );
    ids.push(safeId(result.rows[0].id));
  }
  return { status: "created", ids };
}

export async function claimTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
  pool = databasePool(),
): Promise<T> {
  const client = await pool.connect();
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await client.query("begin");
        const result = await operation(client);
        await client.query("commit");
        return result;
      } catch (error) {
        await client.query("rollback");
        const code = (error as { code?: string }).code;
        if (attempt < 2 && (code === "40001" || code === "40P01")) continue;
        throw error;
      }
    }
    throw new Error("Claim retry limit reached");
  } finally {
    client.release();
  }
}

export async function createClaims(
  key: string,
  items: ClaimItem[],
  pool = databasePool(),
): Promise<ClaimResult> {
  return claimTransaction(
    (client) => createClaimsInTransaction(key, items, client),
    pool,
  );
}

export async function releaseClaims(
  key: string,
  pool = databasePool(),
): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) return false;
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(
      "select pg_advisory_xact_lock(hashtextextended($1, 0))",
      [key],
    );
    const categories = await client.query<{ category_id: string }>(
      `select distinct category_id from staytrack.inventory_claims
       where idempotency_key = $1 order by category_id`,
      [key],
    );
    if (!categories.rowCount) {
      await client.query("rollback");
      return false;
    }
    for (const row of categories.rows)
      await client.query("select pg_advisory_xact_lock($1::bigint)", [
        safeId(row.category_id),
      ]);
    await client.query(
      "update staytrack.inventory_claims set state = 'released' where idempotency_key = $1 and state in ('held', 'confirmed')",
      [key],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function revalidateClaim(
  id: number,
  next: {
    start: number;
    end: number;
    bufferMinutes: number;
    roomId: number;
    state: "held" | "confirmed";
  },
  pool = databasePool(),
): Promise<boolean> {
  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !Number.isSafeInteger(next.start) ||
    !Number.isSafeInteger(next.end) ||
    next.start >= next.end ||
    !Number.isSafeInteger(next.bufferMinutes) ||
    next.bufferMinutes < 0 ||
    next.bufferMinutes > 1440 ||
    !Number.isFinite(new Date(next.start).getTime()) ||
    !Number.isFinite(
      new Date(next.end + next.bufferMinutes * 60000).getTime(),
    ) ||
    !Number.isSafeInteger(next.roomId) ||
    next.roomId < 1 ||
    !["held", "confirmed"].includes(next.state)
  )
    return false;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const initial = await client.query<{ category_id: string }>(
      "select category_id from staytrack.inventory_claims where id = $1",
      [id],
    );
    if (!initial.rowCount) {
      await client.query("rollback");
      return false;
    }
    const categoryId = safeId(initial.rows[0].category_id);
    await client.query("select pg_advisory_xact_lock($1::bigint)", [
      categoryId,
    ]);
    const current = await client.query<{ state: string; category: string }>(
      `select i.state, c.code as category from staytrack.inventory_claims i
       join staytrack.room_categories c on c.id = i.category_id
       where i.id = $1 for update of i`,
      [id],
    );
    if (
      !current.rowCount ||
      [
        "released",
        "expired",
        "proof_pending_review",
        "walkin_reserved",
      ].includes(current.rows[0].state) ||
      (current.rows[0].state === "confirmed" && next.state !== "confirmed")
    ) {
      await client.query("rollback");
      return false;
    }
    const room = await client.query<{
      id: string;
      category: string;
      operational_state: string;
    }>(
      `select r.id, c.code as category, r.operational_state from staytrack.rooms r
       join staytrack.room_categories c on c.id = r.category_id
       where r.id = $1 and r.category_id = $2 and r.active`,
      [next.roomId, categoryId],
    );
    if (!room.rowCount) {
      await client.query("rollback");
      return false;
    }
    const claims = await client.query<{
      id: string;
      start_at: Date;
      end_at: Date;
      buffer_minutes: number;
    }>(
      `select id, start_at, end_at, buffer_minutes from staytrack.inventory_claims
       where room_id = $1 and id <> $2 and state not in ('released', 'expired')`,
      [next.roomId, id],
    );
    const blocks = await client.query<{ start_at: Date; end_at: Date | null }>(
      "select start_at, end_at from staytrack.room_blocks where room_id = $1",
      [next.roomId],
    );
    const existing: Occupancy[] = claims.rows.map((row) => ({
      id: String(row.id),
      category: current.rows[0].category,
      roomId: next.roomId,
      start: millis(row.start_at),
      end: millis(row.end_at),
      bufferMinutes: row.buffer_minutes,
    }));
    const assignment = allocateRooms(
      [
        {
          id: next.roomId,
          category: room.rows[0].category,
          ready: room.rows[0].operational_state === "ready",
        },
      ],
      existing,
      blocks.rows.map((row) => ({
        roomId: next.roomId,
        start: millis(row.start_at),
        end: row.end_at ? millis(row.end_at) : null,
      })),
      [
        {
          id: String(id),
          category: current.rows[0].category,
          ...next,
        },
      ],
    );
    if (!assignment) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `update staytrack.inventory_claims set room_id = $2, start_at = $3, end_at = $4,
       buffer_minutes = $5, buffered_end_at = $6, state = $7 where id = $1`,
      [
        id,
        next.roomId,
        instant(next.start),
        instant(next.end),
        next.bufferMinutes,
        instant(next.end + next.bufferMinutes * 60000),
        next.state,
      ],
    );
    await client.query("commit");
    return true;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
