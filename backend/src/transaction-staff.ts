import type { PoolClient } from "pg";
import { BookingError } from "./booking-quote.js";

export async function requireTransactionStaff(
  db: Pick<PoolClient, "query">,
  actor: string,
) {
  if (
    !(
      await db.query(
        "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
        [actor],
      )
    ).rowCount
  )
    throw new BookingError("Staff access denied.", 403);
}
