import assert from "node:assert/strict";
import { test } from "node:test";
import {
  minimumExtensionPayment,
  nextExtensionCheckout,
  settlementDue,
  parseExtensionInput,
} from "../dist/stay-change-policy.js";
test("X03 T03/T16 exact deposit threshold and purchased clock anchor", () => {
  assert.equal(minimumExtensionPayment(40001), 20001);
  assert.equal(minimumExtensionPayment(0), 0);
  assert.equal(
    nextExtensionCheckout("2027-01-01T09:00:00.000Z", 0, 180),
    "2027-01-01T12:00:00.000Z",
  );
  assert.equal(
    nextExtensionCheckout("2027-01-01T09:00:00.000Z", 180, 180),
    "2027-01-01T15:00:00.000Z",
  );
  for (const v of [-1, 0.5, 2 ** 53, NaN])
    assert.throws(() => minimumExtensionPayment(v));
});
test("X03 pending funds never settle original debt; corrupted allocations fail", () => {
  assert.equal(
    settlementDue(50000, [
      { amountCentavos: 40000, creditCentavos: 0, allocatedCentavos: 20000 },
    ]),
    70000,
  );
  assert.equal(settlementDue(50000, []), 50000);
  assert.throws(() =>
    settlementDue(0, [
      { amountCentavos: 100, creditCentavos: 50, allocatedCentavos: 60 },
    ]),
  );
});
test("X03 extension input rejects browser prices, clocks, beds and unsafe revisions", () => {
  const v = {
    requestKey: "x03-synthetic-request",
    expectedRevision: 0,
    blocks: [180],
    reason: "Guest requested extension",
  };
  assert.deepEqual(parseExtensionInput(v), v);
  for (const patch of [
    { price: 1 },
    { startAt: "forged" },
    { extraBed: true },
    { expectedRevision: -1 },
    { blocks: [60] },
    { blocks: [] },
    { reason: "\ninvalid" },
  ])
    assert.throws(() => parseExtensionInput({ ...v, ...patch }));
});
