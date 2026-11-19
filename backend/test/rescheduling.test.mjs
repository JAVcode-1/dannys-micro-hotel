import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseRescheduleInput,
  classifyReschedule,
} from "../dist/rescheduling-policy.js";
const now = Date.UTC(2026, 0, 1);
const input = {
  requestKey: "synthetic-reschedule-001",
  expectedRevision: 0,
  startAt: "2027-01-02T02:00:00Z",
  endAt: "2027-01-02T08:00:00Z",
  blocks: [360],
  reason: "Guest requested move",
};
const source = {
  channel: "online",
  startAt: "2027-01-01T02:00:00Z",
  endAt: "2027-01-01T08:00:00Z",
  blocks: [360],
  totalCentavos: 40000,
  extraBedCentavos: 0,
};
test("X02 same package preserves purchased price; changed duration remains a proposal", () => {
  assert.deepEqual(classifyReschedule(source, input, 50000), {
    eligibility: "eligible",
    deltaCentavos: 0,
  });
  for (const price of [20000, 40000, 60000])
    assert.deepEqual(
      classifyReschedule(
        source,
        { ...input, blocks: [180], endAt: "2027-01-02T05:00:00Z" },
        price,
      ),
      { eligibility: "financial_policy_pending", deltaCentavos: price - 40000 },
    );
  assert.equal(
    classifyReschedule({ ...source, channel: "walk_in" }, input, null)
      .eligibility,
    "walk_in_policy_pending",
  );
  assert.equal(
    classifyReschedule({ ...source, extraBedCentavos: 10000 }, input, null)
      .eligibility,
    "extra_bed_policy_pending",
  );
  assert.throws(() =>
    classifyReschedule(
      source,
      { ...input, startAt: source.startAt, endAt: source.endAt },
      null,
    ),
  );
});
test("X02 parser rejects normalized calendars, unzoned/non-minute dates, end mismatch and untrusted fields", () => {
  assert.equal(
    parseRescheduleInput(input, now).startAt,
    "2027-01-02T02:00:00.000Z",
  );
  for (const patch of [
    { startAt: "2027-02-30T02:00:00Z" },
    { startAt: "2027-01-02T02:00" },
    { startAt: "2027-01-02T02:00:01Z" },
    { expectedRevision: -1 },
    { expectedRevision: 2 ** 53 },
    { endAt: "2027-01-02T09:00:00Z" },
    { blocks: [] },
    { blocks: [60] },
    { blocks: Array(31).fill(360) },
    { reason: "\nunsafe" },
    { reason: " " },
    { reason: "x".repeat(1001) },
    { actorId: "forged" },
    { amountCentavos: 1 },
  ])
    assert.throws(() => parseRescheduleInput({ ...input, ...patch }, now));
});

test("X02 fixed conflicts on other rooms or dates do not prevent a free destination", async () => {
  const { chooseRescheduleRoom } = await import("../dist/rescheduling.js");
  const rooms = [
    { id: 1, category: "double_standard", ready: true },
    { id: 2, category: "double_standard", ready: true },
  ];
  const target = {
    id: "target",
    category: "double_standard",
    roomId: null,
    start: 1000,
    end: 2000,
    bufferMinutes: 0,
  };
  const claims = [
    { ...target, id: "old", roomId: 1, start: 100, end: 200 },
    { ...target, id: "inactive", roomId: 99, start: 1000, end: 2000 },
  ];
  const blocks = [
    { roomId: 1, start: 100, end: 300 },
    { roomId: 1, start: 1000, end: 2000 },
  ];
  assert.equal(chooseRescheduleRoom(rooms, claims, blocks, target, 0), 2);
});
