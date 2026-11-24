import assert from "node:assert/strict";
import test from "node:test";
import { quoteHall, hallDefaults } from "../dist/hall-scheduling.js";

const now = Date.parse("2026-11-20T06:00:00+08:00");
const quote = (start, minutes, overrides = {}, ready = false) =>
  quoteHall(
    { start, minutes, setup: "theater", attendees: 70, ...overrides },
    hallDefaults,
    now,
    ready,
  );

test("hall uses the package price at the start time and supports overnight bookings", () => {
  const result = quote("2026-11-20T16:00", 240);
  assert.equal(result.total, 400000);
  assert.equal(result.protectedStart, "2026-11-20T07:30:00.000Z");
  assert.equal(result.protectedEnd, "2026-11-20T12:30:00.000Z");
  assert.equal(quote("2026-11-20T16:00", 180).total, 300000);
  assert.equal(quote("2026-11-20T17:00", 180).total, 500000);
  assert.equal(quote("2026-11-20T22:00", 240).total, 600000);
  assert.equal(quote("2026-11-21T02:00", 180).total, 500000);
  assert.equal(quote("2026-11-21T08:00", 180).total, 300000);
});

test("hall rejects invalid dates, expired starts, capacity and durations", () => {
  for (const [start, minutes, overrides] of [
    ["2026-11-31T12:00", 180, {}],
    ["2026-11-20T06:00", 180, {}],
    ["2026-11-20T16:00", 210, {}],
    ["2026-11-20T16:00", 180, { setup: "room", attendees: 51 }],
  ])
    assert.throws(() => quote(start, minutes, overrides));
});

test("short-notice bookings use readiness and preserve setup protection and horizon", () => {
  assert.equal(quote("2026-11-20T08:00", 180).total, 300000);
  assert.throws(() => quote("2026-11-20T06:15", 180), /time to prepare/);
  const ready = quote("2026-11-20T06:15", 180, {}, true);
  assert.equal(Date.parse(ready.protectedStart), now);
  assert.equal(ready.protectedEnd, "2026-11-20T01:45:00.000Z");
  assert.throws(() => quote("2027-04-20T08:00", 180), /booking horizon/);
});
