import assert from "node:assert/strict";
import { test } from "node:test";
import { countdown, serverTime } from "../src/stay-clock.ts";
test("W03 absolute countdown survives delayed ticks, reload and client clock skew", () => {
  const end = Date.parse("2026-11-19T09:10:00Z");
  assert.deepEqual(countdown(end, end - 15 * 60000, 15), {
    remainingMs: 900000,
    state: "warning",
    warningMinutes: 15,
  });
  assert.equal(countdown(end, end - 900001, 15).state, "active");
  assert.equal(countdown(end, end - 5 * 60000, 15).warningMinutes, 15);
  assert.equal(countdown(end, end - 60000, null).state, "active");
  assert.equal(countdown(end, end, 15).state, "overdue");
  assert.equal(countdown(end, end + 7200000, 30).remainingMs, -7200000);
  assert.equal(
    serverTime({ serverMs: end - 60000, receivedMs: 100 }, 30100),
    end - 30000,
  );
  assert.equal(
    countdown(
      end,
      serverTime({ serverMs: end - 60000, receivedMs: 100 }, 7200100),
      null,
    ).state,
    "overdue",
  );
});
