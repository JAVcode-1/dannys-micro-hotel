import assert from "node:assert/strict";
import { test } from "node:test";
import { stayTimes } from "../dist/check-in.js";

test("T12 uses actual check-in plus purchased duration, T13 preserves online checkout", () => {
  const start = new Date("2026-11-19T14:05:00+08:00");
  const end = new Date("2026-11-19T17:05:00+08:00");
  assert.equal(
    stayTimes(
      "walk_in",
      start,
      end,
      new Date("2026-11-19T14:10:00+08:00"),
    ).end.toISOString(),
    "2026-11-19T09:10:00.000Z",
  );
  assert.equal(
    stayTimes("online", start, end, new Date(+start + 45 * 60000)).end,
    end,
  );
  assert.throws(
    () => stayTimes("online", start, end, end),
    /Scheduled stay has ended/,
  );
});

test("early online check-in needs explicit approval and preserves purchased duration", () => {
  const start = new Date("2026-11-21T14:00:00+08:00");
  const end = new Date("2026-11-21T17:00:00+08:00");
  const now = new Date(+start - 30 * 60000);
  assert.throws(
    () => stayTimes("online", start, end, now),
    /Explicit early check-in approval/,
  );
  const moved = stayTimes("online", start, end, now, true);
  assert.equal(+moved.start, +now);
  assert.equal(+moved.end - +moved.start, +end - +start);
  assert.equal(+moved.end, +end - 30 * 60000);
});
