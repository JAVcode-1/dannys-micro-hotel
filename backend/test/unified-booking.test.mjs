import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseOnlineHall,
  unifiedTotal,
  onlineHallCancellationEligible,
} from "../dist/unified-booking.js";

test("unified prices conserve exact centavos and reject unsafe totals", () => {
  assert.equal(unifiedTotal(20001, 300000), 320001);
  assert.throws(() => unifiedTotal(Number.MAX_SAFE_INTEGER, 1));
});
test("online Hall rejects staff-only fields and unbounded requests", () => {
  const hall = {
    setup: "theater",
    start: "2026-12-01T10:00",
    minutes: 180,
    attendees: 70,
  };
  assert.equal(parseOnlineHall(hall).setup, "theater");
  assert.throws(() =>
    parseOnlineHall({ ...hall, noticeReason: "guest override" }),
  );
  assert.throws(() => parseOnlineHall({ ...hall, requests: "x".repeat(2001) }));
});
test("Hall free cancellation ends at exact hour or actual start", () => {
  assert.equal(onlineHallCancellationEligible(1000, null, 3600999), true);
  assert.equal(onlineHallCancellationEligible(1000, null, 3601000), false);
  assert.equal(onlineHallCancellationEligible(1000, 2000, 1500), false);
});
