import assert from "node:assert/strict";
import { test } from "node:test";
import {
  walkInBalance,
  parseWalkInPayment,
  createWalkInBooking,
  recordWalkInPayment,
} from "../dist/walkins.js";
test("W01 journal minimum rounds up odd centavos and cannot count missing or unverified payments", () => {
  assert.deepEqual(walkInBalance(20001, 10000), {
    totalCentavos: 20001,
    collectedCentavos: 10000,
    balanceCentavos: 10001,
    minimumCentavos: 10001,
    paymentMinimumMet: false,
    normalCheckInEligible: false,
  });
  assert.equal(walkInBalance(20001, 10001).normalCheckInEligible, true);
  assert.equal(walkInBalance(20000, 20000, false).normalCheckInEligible, false);
  for (const [charged, paid] of [
    [20000, 20001],
    [-1, 0],
    [20000, -1],
    [20000, 1.5],
    [NaN, 0],
  ])
    assert.throws(() => walkInBalance(charged, paid));
});
const cash = {
  method: "cash",
  amountCentavos: 10000,
  requestKey: "w01-cash-request-0001",
};
const gcash = {
  ...cash,
  method: "gcash",
  verification: {
    reference: " TEST-REF 001 ",
    recipient: "TEST PAYEE",
    receivedAt: "2026-11-19T01:05:00+08:00",
    ledgerChecked: true,
    receivingAccountChecked: true,
    timeChecked: true,
  },
};
test("W01 only verified GCash and positive integer-centavo payments reach the ledger", () => {
  assert.deepEqual(parseWalkInPayment(cash), cash);
  assert.equal(parseWalkInPayment(gcash).verification.reference, "TESTREF001");
  for (const patch of [
    { ledgerChecked: false },
    { receivingAccountChecked: false },
    { timeChecked: false },
    { reference: "" },
    { recipient: "" },
    { receivedAt: "2026-11-19T01:00:00" },
  ])
    assert.throws(() =>
      parseWalkInPayment({
        ...gcash,
        verification: { ...gcash.verification, ...patch },
      }),
    );
  for (const patch of [
    { verification: null },
    { amountCentavos: 0 },
    { amountCentavos: -1 },
    { amountCentavos: 1.5 },
    { method: "unverified_gcash" },
    { requestKey: "bad" },
  ])
    assert.throws(() => parseWalkInPayment({ ...gcash, ...patch }));
});
test("W01 booking and payment recheck active staff inside the transaction and rollback revoked access", async () => {
  const statements = [];
  const client = {
    query: async (sql) => {
      statements.push(sql);
      return { rows: [], rowCount: 0 };
    },
    release() {},
  };
  const pool = { connect: async () => client };
  const item = {
    category: "double_standard",
    startAt: "2027-01-01T06:00:00Z",
    blocks: [180],
    adults: 2,
    children: 0,
    extraBed: false,
  };
  await assert.rejects(
    createWalkInBooking(
      "actor",
      "w01-booking-request-001",
      "Test Guest",
      [item],
      pool,
    ),
    /Staff access denied/,
  );
  await assert.rejects(
    recordWalkInPayment(
      "actor",
      "11111111-1111-4111-8111-111111111111",
      cash,
      pool,
    ),
    /Staff access denied/,
  );
  assert.equal(statements.filter((sql) => sql === "rollback").length, 2);
  assert.ok(!statements.some((sql) => sql.startsWith("insert")));
});
