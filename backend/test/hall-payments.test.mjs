import assert from "node:assert/strict";
import test from "node:test";
import {
  hallDepositMet,
  hallStartPaymentIssue,
  normalizeHallReceipt,
} from "../dist/hall-payments.js";

test("hall deposit threshold rounds up in integer centavos", () => {
  assert.equal(hallDepositMet(500001n, 250000n), false);
  assert.equal(hallDepositMet(500001n, 250001n), true);
});

test("only walk-ins can start with the verified deposit, including refund checks", () => {
  assert.equal(
    hallStartPaymentIssue(true, 500001n, 250001n, 250001n),
    undefined,
  );
  assert.match(
    hallStartPaymentIssue(true, 500001n, 250000n, 250000n),
    /at least half/,
  );
  assert.match(
    hallStartPaymentIssue(true, 500001n, 250001n, 250000n),
    /refund approval/,
  );
  assert.match(
    hallStartPaymentIssue(false, 500001n, 250001n, 250001n),
    /Full verified/,
  );
});
test("hall accepts actual verified money and canonicalizes GCash identity", () => {
  assert.throws(() =>
    normalizeHallReceipt({
      method: "gcash",
      amount: 100,
      reference: "ABC-123",
    }),
  );
  assert.throws(() => normalizeHallReceipt({ method: "cash", amount: 100 }));
  assert.deepEqual(
    normalizeHallReceipt({
      method: "gcash",
      amount: 100,
      reference: " abc-123 ",
      verified: true,
    }),
    { method: "gcash", amount: 100, reference: "ABC123" },
  );
});
