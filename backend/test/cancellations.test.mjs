import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cancellationEligibility,
  parseRefundAction,
} from "../dist/cancellations.js";
test("X01 T17/T18 uses original confirmation, strict 60m boundary and item check-in", () => {
  const at = Date.parse("2026-11-19T10:00:00Z");
  const item = {
    channel: "online",
    confirmationAt: at,
    checkedIn: false,
    extraBedCentavos: 0,
    confirmed: true,
  };
  assert.equal(cancellationEligibility(item, at + 40 * 60000), "eligible");
  assert.equal(cancellationEligibility(item, at + 3600000 - 1), "eligible");
  assert.equal(cancellationEligibility(item, at + 3600000), "outside_window");
  assert.equal(
    cancellationEligibility({ ...item, checkedIn: true }, at + 1),
    "checked_in",
  );
  assert.equal(
    cancellationEligibility({ ...item, channel: "walk_in" }, at + 1),
    "walk_in_policy_pending",
  );
  assert.equal(
    cancellationEligibility({ ...item, extraBedCentavos: 10000 }, at + 1),
    "extra_bed_policy_pending",
  );
});
test("X01 refund parser requires actual source-payer and transfer verification, safe money and zoned time", () => {
  for (const value of [
    { action: "claim", requestKey: "x01-test-00000001" },
    {
      action: "transfer",
      requestKey: "x01-test-00000001",
      amountCentavos: NaN,
      reference: "TEST",
      transferredAt: "2026-11-19T10:00",
      transferChecked: true,
    },
  ])
    assert.throws(() => parseRefundAction(value));
});
