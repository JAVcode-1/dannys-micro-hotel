import { createHash } from "node:crypto";
import type { Pool } from "pg";

// Trusted proxy configuration determines the source address; forwarding headers alone never do.
export async function sharedRequestLimit(
  pool: Pick<Pool, "query">,
  address: string,
  now = new Date(),
) {
  const digest = createHash("sha256")
    .update("api:" + address)
    .digest("hex");
  const result = await pool.query(
    `insert into staytrack.request_limits(key_digest,window_start,count) values($1,$2,1)
    on conflict(key_digest) do update set count=case when request_limits.window_start<=$2-interval '1 minute' then 1 else least(31,request_limits.count+1) end,
    window_start=case when request_limits.window_start<=$2-interval '1 minute' then $2 else request_limits.window_start end
    returning count,greatest(1,ceil(extract(epoch from(window_start+interval '1 minute'-$2))))::int as retry`,
    [digest, now],
  );
  return {
    allowed: result.rows[0].count <= 30,
    retryAfter: result.rows[0].retry,
  };
}
