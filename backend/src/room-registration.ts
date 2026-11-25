import { databasePool } from "./database.js";
import { claimTransaction } from "./inventory-claims.js";
import { requireTransactionStaff } from "./transaction-staff.js";
import { BookingError } from "./booking-quote.js";
import { hasControlCharacters } from "./payment-media.js";

export async function registerPhysicalRoom(
  actor: string,
  value: unknown,
  pool = databasePool(),
) {
  const body = value as {
    code?: unknown;
    category?: unknown;
    note?: unknown;
    requestKey?: unknown;
  } | null;
  if (
    !body ||
    typeof body.code !== "string" ||
    !body.code.trim() ||
    body.code.length > 80 ||
    hasControlCharacters(body.code) ||
    typeof body.category !== "string" ||
    !["double_standard", "family_executive"].includes(body.category) ||
    typeof body.note !== "string" ||
    !body.note.trim() ||
    body.note.length > 1000 ||
    hasControlCharacters(body.note) ||
    typeof body.requestKey !== "string" ||
    !/^[A-Za-z0-9_-]{16,100}$/.test(body.requestKey)
  )
    throw new BookingError(
      "Enter the actual room identifier, category, registration note and retry key.",
    );
  const code = body.code.trim();
  const note = body.note.trim();
  return claimTransaction(async (db) => {
    await requireTransactionStaff(db, actor);
    // Registration and rename share this lock to prevent case-insensitive duplicates.
    await db.query("select pg_advisory_xact_lock(741501)");
    const prior = (
      await db.query(
        `select e.*, c.code category from staytrack.room_administration_events e
      join staytrack.rooms r on r.id=e.room_id join staytrack.room_categories c on c.id=r.category_id
      where e.actor_auth_user_id=$1 and e.request_key=$2`,
        [actor, body.requestKey],
      )
    ).rows[0];
    if (prior) {
      const registered = (
        await db.query(
          "select 1 from staytrack.staff_audit where actor_auth_user_id=$1 and action=$2",
          [actor, `room.registered:${prior.room_id}:${body.requestKey}`],
        )
      ).rowCount;
      if (
        !registered ||
        prior.new_code !== code ||
        prior.note !== note ||
        prior.category !== body.category
      )
        throw new BookingError(
          "Registration retry key is already in use.",
          409,
        );
      return { id: String(prior.room_id), replayed: true };
    }
    const category = (
      await db.query(
        "select id from staytrack.room_categories where code=$1 and active",
        [body.category],
      )
    ).rows[0];
    if (!category) throw new BookingError("Choose an active room category.");
    await db.query("select pg_advisory_xact_lock($1::bigint)", [category.id]);
    if (
      (
        await db.query(
          "select 1 from staytrack.rooms where lower(btrim(code))=lower($1)",
          [code],
        )
      ).rowCount
    )
      throw new BookingError(
        "That physical room identifier is already registered.",
        409,
      );
    const count = Number(
      (
        await db.query(
          "select count(*) n from staytrack.rooms where category_id=$1",
          [category.id],
        )
      ).rows[0].n,
    );
    if (count >= (body.category === "double_standard" ? 10 : 5))
      throw new BookingError(
        "All physical rooms for this category are already registered. Edit an existing room instead.",
        409,
      );
    const room = (
      await db.query(
        "insert into staytrack.rooms(category_id,code,operational_state,active) values($1,$2,'unverified',false) returning id",
        [category.id, code],
      )
    ).rows[0];
    await db.query(
      `insert into staytrack.room_administration_events(room_id,actor_auth_user_id,request_key,old_code,new_code,old_active,new_active,note)
      values($1,$2,$3,$4,$4,false,false,$5)`,
      [room.id, actor, body.requestKey, code, note],
    );
    await db.query(
      "insert into staytrack.staff_audit(actor_auth_user_id,action) values($1,$2)",
      [actor, `room.registered:${room.id}:${body.requestKey}`],
    );
    return { id: String(room.id), replayed: false };
  }, pool);
}
