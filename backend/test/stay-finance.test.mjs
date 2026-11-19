import assert from "node:assert/strict";
import { test } from "node:test";
import { parseStayReceipt } from "../dist/stay-finance.js";
import {
  stayInstant,
  quoteAdditionalPackages,
} from "../dist/stay-change-policy.js";
const cash = {
  requestKey: "x03-synthetic-cash-001",
  reason: "Staff received synthetic cash",
  method: "cash",
  cashReceived: true,
  amountCentavos: 1,
  receivedAt: "2026-11-19T10:00:00Z",
};
test("X03 receipts require actual cash or GCash evidence and strict fields", () => {
  assert.equal(parseStayReceipt(cash).amountCentavos, 1);
  for (const patch of [
    { cashReceived: false },
    { amountCentavos: 0 },
    { amountCentavos: 0.01 },
    { amountCentavos: 2 ** 53 },
    { screenshot: true },
    { method: "gcash", cashReceived: undefined },
    { receivedAt: "2026-02-30T10:00:00Z" },
  ])
    assert.throws(() => parseStayReceipt({ ...cash, ...patch }));
  const v = {
    ...cash,
    method: "gcash",
    cashReceived: undefined,
    verification: {
      reference: "synthetic-reference",
      recipient: "TEST ONLY",
      ledgerChecked: true,
      receivingAccountChecked: true,
      timeChecked: true,
    },
  };
  assert.equal(
    parseStayReceipt(v).verification.reference,
    "SYNTHETICREFERENCE",
  );
  assert.throws(() =>
    parseStayReceipt({
      ...v,
      verification: { ...v.verification, timeChecked: false },
    }),
  );
  assert.throws(() => stayInstant("2026-01-01T10:00:00"));
  assert.throws(() => stayInstant("2026-01-01T10:00:00-09:00"));
});
test("X03 additional Family packages never permit three hours or repeat the existing extra bed", () => {
  const catalog = [
    {
      id: "synthetic-package",
      version: 1,
      category: "family_executive",
      duration_minutes: 360,
      price_centavos: 60000,
    },
  ];
  const q = quoteAdditionalPackages(
    "family_executive",
    "2026-01-01T00:00:00Z",
    [360],
    catalog,
    2,
    0,
  );
  assert.equal(q.totalCentavos, 60000);
  assert.equal(q.extraBedCentavos, 0);
  assert.throws(() =>
    quoteAdditionalPackages(
      "family_executive",
      "2026-01-01T00:00:00Z",
      [180],
      [{ ...catalog[0], duration_minutes: 180 }],
      2,
      0,
    ),
  );
  assert.equal(
    quoteAdditionalPackages(
      "family_executive",
      "2026-01-01T00:00:00Z",
      [360],
      [{ ...catalog[0], price_centavos: 0 }],
      2,
      0,
    ).totalCentavos,
    0,
  );
});
