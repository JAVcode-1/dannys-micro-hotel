import { databasePool } from "./database.js";

export async function staffRooms(pool = databasePool()) {
  const { rows } =
    await pool.query(`select r.id, r.code, c.code as category_code,
    c.name as category_name, r.operational_state, r.active
    from staytrack.rooms r join staytrack.room_categories c on c.id = r.category_id
    order by c.id, r.code`);
  return rows;
}
