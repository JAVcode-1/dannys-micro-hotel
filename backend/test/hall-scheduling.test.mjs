import assert from "node:assert/strict";
import test from "node:test";
import { quoteHall, hallDefaults } from "../dist/hall-scheduling.js";

const now = Date.parse("2026-11-20T06:00:00+08:00");
const quote = (start, minutes, overrides = {}) =>
  quoteHall(
    { start, minutes, setup: "theater", attendees: 70, ...overrides },
    hallDefaults,
    now,
  );

test("hall quotes preserve the booked start rate and snapshot buffers", () => {
  const result = quote("2026-11-20T16:00", 240);
  assert.equal(result.total, 400000);
  assert.equal(result.protectedStart, "2026-11-20T07:30:00.000Z");
  assert.equal(result.protectedEnd, "2026-11-20T12:30:00.000Z");
  assert.equal(quote("2026-11-20T17:00", 180).total, 500000);
});

test("hall rejects invalid dates, capacity and durations", () => {
  for (const [start, minutes, overrides] of [
    ["2026-11-31T12:00", 180, {}],
    ["2026-11-20T07:59", 180, { noticeReason: "Approved request" }],
    ["2026-11-20T20:00", 240, {}],
    ["2026-11-20T16:00", 210, {}],
    ["2026-11-20T16:00", 180, { setup: "room", attendees: 51 }],
  ])
    assert.throws(() => quote(start, minutes, overrides));
});

test("override relaxes notice but preserves preparation and horizon", () => {
  assert.throws(() => quote("2026-11-20T08:00", 180));
  assert.equal(
    quote("2026-11-20T08:00", 180, { noticeReason: "Staff approved" }).total,
    300000,
  );
  const late = Date.parse("2026-11-20T23:30:00+08:00");
  assert.throws(() =>
    quoteHall(
      { start: "2026-11-21T08:00", minutes: 180, setup: "room", attendees: 50 },
      { ...hallDefaults, notice: 540 },
      late,
    ),
  );
  assert.equal(
    quoteHall(
      {
        start: "2026-11-21T08:00",
        minutes: 180,
        setup: "room",
        attendees: 50,
        noticeReason: "Staff approved",
      },
      { ...hallDefaults, notice: 540 },
      late,
    ).total,
    300000,
  );
});
