import { databasePool } from "./database.js";
import { requireTransactionStaff } from "./transaction-staff.js";

export async function publicCatalog(pool = databasePool()) {
  const result =
    await pool.query(`select c.code, c.name, c.standard_occupancy_note,
    p.duration_minutes, p.price_centavos
    from staytrack.room_categories c join staytrack.packages p
      on p.category_id = c.id and p.category_code = c.code
    where c.active and p.active
    order by c.id, p.duration_minutes`);
  return result.rows;
}

export async function changePackagePrice(
  actorId: string,
  code: string,
  duration: number,
  price: number,
  pool?: ReturnType<typeof databasePool>,
) {
  if (
    !["double_standard", "family_executive"].includes(code) ||
    ![180, 360, 720, 1440].includes(duration) ||
    (code === "family_executive" && duration === 180) ||
    !Number.isSafeInteger(price) ||
    price < 0
  )
    return false;
  const client = await (pool ?? databasePool()).connect();
  try {
    await client.query("begin");
    await requireTransactionStaff(client, actorId);
    const current = await client.query(
      `select p.id, p.category_id, p.version from staytrack.packages p
      join staytrack.room_categories c on c.id = p.category_id
      where c.code = $1 and c.active and p.duration_minutes = $2 and p.active for update of p`,
      [code, duration],
    );
    if (current.rowCount !== 1) {
      await client.query("rollback");
      return false;
    }
    const row = current.rows[0];
    await client.query(
      "update staytrack.packages set active = false where id = $1",
      [row.id],
    );
    await client.query(
      `insert into staytrack.packages
      (category_id, category_code, duration_minutes, price_centavos, version)
      values ($1, $2, $3, $4, $5)`,
      [row.category_id, code, duration, price, row.version + 1],
    );
    await client.query(
      `insert into staytrack.staff_audit (actor_auth_user_id, action)
      values ($1, 'catalog.package_price_changed')`,
      [actorId],
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

export async function staffCatalog(pool = databasePool()) {
  const { rows } =
    await pool.query(`select c.code, c.name, c.active as category_active,
    p.duration_minutes, p.price_centavos, p.version, p.active
    from staytrack.room_categories c join staytrack.packages p on p.category_id = c.id
    order by c.id, p.duration_minutes, p.version desc`);
  return rows;
}

export async function setPackageActive(
  actorId: string,
  code: string,
  duration: number,
  active: boolean,
  pool?: ReturnType<typeof databasePool>,
) {
  if (
    !["double_standard", "family_executive"].includes(code) ||
    ![180, 360, 720, 1440].includes(duration) ||
    (code === "family_executive" && duration === 180) ||
    typeof active !== "boolean"
  )
    return false;
  const client = await (pool ?? databasePool()).connect();
  try {
    await client.query("begin");
    await requireTransactionStaff(client, actorId);
    const category = await client.query(
      "select id from staytrack.room_categories where code = $1 and active for update",
      [code],
    );
    if (category.rowCount !== 1) {
      await client.query("rollback");
      return false;
    }
    const rows = await client.query(
      `select id, active from staytrack.packages
      where category_id = $1 and duration_minutes = $2 order by version desc limit 1 for update`,
      [category.rows[0].id, duration],
    );
    if (rows.rowCount !== 1 || rows.rows[0].active === active) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      "update staytrack.packages set active = $1 where id = $2",
      [active, rows.rows[0].id],
    );
    await client.query(
      `insert into staytrack.staff_audit (actor_auth_user_id, action)
      values ($1, $2)`,
      [
        actorId,
        active ? "catalog.package_activated" : "catalog.package_deactivated",
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

export async function updateCategory(
  actorId: string,
  code: string,
  name: string,
  active: boolean,
  pool?: ReturnType<typeof databasePool>,
) {
  if (
    !["double_standard", "family_executive"].includes(code) ||
    typeof name !== "string" ||
    !name.trim() ||
    name.length > 80 ||
    typeof active !== "boolean"
  )
    return false;
  const client = await (pool ?? databasePool()).connect();
  try {
    await client.query("begin");
    await requireTransactionStaff(client, actorId);
    const result = await client.query(
      `update staytrack.room_categories
      set name = $1, active = $2 where code = $3`,
      [name.trim(), active, code],
    );
    if (result.rowCount !== 1) {
      await client.query("rollback");
      return false;
    }
    await client.query(
      `insert into staytrack.staff_audit (actor_auth_user_id, action)
      values ($1, 'catalog.category_updated')`,
      [actorId],
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
