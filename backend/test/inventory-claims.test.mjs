import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";
import { createClaims } from "../dist/inventory-claims.js";

test("claim transaction retries a serialization error and replays the same request", async () => {
  const item = {
    category: "double_standard",
    start: 1_800_000_000_000,
    end: 1_800_003_600_000,
    bufferMinutes: 15,
  };
  const hash = createHash("sha256")
    .update(JSON.stringify([item]))
    .digest("hex");
  const calls = [];
  let firstLock = true;
  const client = {
    async query(sql) {
      calls.push(sql);
      if (sql.includes("hashtextextended") && firstLock) {
        firstLock = false;
        throw Object.assign(new Error("serialization"), { code: "40001" });
      }
      if (sql.includes("select request_hash"))
        return { rowCount: 1, rows: [{ request_hash: hash }] };
      if (sql.includes("select id from staytrack.inventory_claims"))
        return { rows: [{ id: "7" }] };
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  assert.deepEqual(
    await createClaims("test-retry-request-001", [item], {
      connect: async () => client,
    }),
    { status: "replayed", ids: [7] },
  );
  assert.deepEqual(
    calls.filter(
      (sql) => sql === "begin" || sql === "rollback" || sql === "commit",
    ),
    ["begin", "rollback", "begin", "commit"],
  );
});
