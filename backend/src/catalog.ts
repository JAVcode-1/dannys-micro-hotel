import { databasePool } from "./database.js";

export async function publicCatalog() {
  const result = await databasePool()
    .query(`select c.code, c.name, c.standard_occupancy_note,
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
) {
  if (
    !["double_standard", "family_executive"].includes(code) ||
    ![180, 360, 720, 1440].includes(duration) ||
    (code === "family_executive" && duration === 180) ||
    !Number.isSafeInteger(price) ||
    price < 0
  )
    return false;
  const client = await databasePool().connect();
  try {
    await client.query("begin");
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
