import assert from "node:assert/strict";
import { test } from "node:test";
import { countdown, serverTime } from "../src/stay-clock.ts";
test("W03 absolute countdown survives delayed ticks, reload and client clock skew", () => {
  const end = Date.parse("2026-11-19T09:10:00Z");
  assert.deepEqual(countdown(end, end - 15 * 60000, [30, 15, 5]), {
    remainingMs: 900000,
    state: "warning",
    warningMinutes: 15,
  });
  assert.equal(countdown(end, end, []).state, "overdue");
  assert.equal(countdown(end, end + 7200000, [30]).remainingMs, -7200000);
  assert.equal(countdown(end, end - 3600000, [30]).state, "active");
  assert.equal(
    serverTime({ serverMs: end - 60000, receivedMs: 100 }, 30100),
    end - 30000,
  );
  assert.equal(
    countdown(
      end,
      serverTime({ serverMs: end - 60000, receivedMs: 100 }, 7200100),
      [],
    ).state,
    "overdue",
  );
});
