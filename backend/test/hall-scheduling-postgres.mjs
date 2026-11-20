import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";

export async function hallSchedulingPostgres(t, pool) {
  await t.test(
    "hall exclusion protects preparation and cleanup across setups",
    async () => {
      const migration = new URL(
        "../../supabase/migrations/20261120001700_function_hall_scheduling.sql",
        import.meta.url,
      );
      await pool.query(readFileSync(migration, "utf8"));
      const insert = (setup, start, end) =>
        pool.query(
          `
      insert into staytrack.hall_claims(setup,attendees,event_start,event_end,preparation_start,cleanup_end)
      values($1,25,$2,$3,$2::timestamptz-interval '30 minutes',$3::timestamptz+interval '30 minutes')`,
          [setup, start, end],
        );
      const concurrent = await Promise.allSettled([
        insert("theater", "2026-12-01T14:00+08:00", "2026-12-01T17:00+08:00"),
        insert("room", "2026-12-01T14:00+08:00", "2026-12-01T17:00+08:00"),
      ]);
      assert.equal(
        concurrent.filter((result) => result.status === "fulfilled").length,
        1,
      );
      assert.equal(
        concurrent.find((result) => result.status === "rejected").reason.code,
        "23P01",
      );
      await assert.rejects(
        insert("room", "2026-12-01T17:59+08:00", "2026-12-01T20:59+08:00"),
        { code: "23P01" },
      );
      await insert("room", "2026-12-01T18:00+08:00", "2026-12-01T21:00+08:00");
    },
  );
}
