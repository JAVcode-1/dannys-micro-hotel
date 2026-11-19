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
