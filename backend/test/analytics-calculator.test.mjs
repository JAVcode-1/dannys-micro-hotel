import assert from "node:assert/strict";
import test from "node:test";
import {
  purchaseDate,
  replayCollections,
  splitCentavos,
} from "../dist/analytics-calculator.js";

test("splits a receipt across room balances and then across package and extra bed", () => {
  assert.deepEqual(splitCentavos(101n, [301n, 199n]), [61n, 40n]);
  assert.deepEqual(splitCentavos(61n, [201n, 100n]), [41n, 20n]);
});

test("counts each recorded receipt once, replays earlier balances and attributes a later refund", () => {
  const receipt = { id: "walkin:1", reservation: "r", at: "01", amount: 101n };
  const result = replayCollections(
    {
      items: [
        { id: "a", reservation: "r", category: "family", at: "00" },
        { id: "b", reservation: "r", category: "standard", at: "00" },
      ],
      charges: [
        { id: "package-a", item: "a", at: "00", amount: 201n },
        { id: "bed", item: "a", at: "00", amount: 100n },
        { id: "package-b", item: "b", at: "00", amount: 199n },
      ],
      receipts: [receipt, receipt, { ...receipt, id: "walkin:2" }],
      allocations: [],
      refunds: [
        {
          id: "refund:a",
          receipt: receipt.id,
          item: "a",
          at: "02",
          amount: 40n,
        },
      ],
    },
    "02",
    "03",
  );
  assert.deepEqual(
    result.map(({ charge, gross, refunds }) => [charge, gross, refunds]),
    [
      ["bed", 0n, 13n],
      ["package-a", 0n, 27n],
    ],
  );
});

test("honors explicit allocations until their recorded release and conserves cash", () => {
  const history = {
    items: [{ id: "a", reservation: "r", category: "family", at: "00" }],
    charges: [
      { id: "bed", item: "a", at: "00", amount: 100n },
      { id: "extension", item: "a", at: "02", amount: 100n },
    ],
    receipts: [
      { id: "stay:1", reservation: "r", item: "a", at: "01", amount: 101n },
    ],
    allocations: [
      {
        receipt: "stay:1",
        charge: "extension",
        item: "a",
        at: "01",
        releasedAt: "03",
        amount: 70n,
      },
    ],
    refunds: [],
  };
  const summarize = (end) =>
    replayCollections(history, "01", end).map(({ charge, gross }) => [
      charge,
      gross,
    ]);
  assert.deepEqual(summarize("03"), [
    ["extension", 70n],
    ["bed", 31n],
  ]);
  assert.deepEqual(summarize("04"), [
    ["bed", 100n],
    [null, 1n],
  ]);
});

test("preserves input order on ties and leaves excess cash unallocated", () => {
  assert.deepEqual(splitCentavos(2n, [1n, 1n, 1n]), [1n, 1n, 0n]);
  assert.deepEqual(splitCentavos(7n, [1n, 0n, 2n]), [1n, 0n, 2n]);
  assert.deepEqual(splitCentavos(7n, [0n, 0n]), [0n, 0n]);
});

test("rejects conflicting GCash registry ownership", () => {
  const history = {
    items: [],
    charges: [],
    allocations: [],
    refunds: [],
    registry: new Map([["REF", "online:1"]]),
    receipts: [
      {
        id: "online:1",
        reservation: "r",
        at: "01",
        amount: 100n,
        gcashReference: "REF",
      },
      {
        id: "stay:1",
        reservation: "r",
        at: "01",
        amount: 100n,
        gcashReference: "REF",
      },
    ],
  };
  assert.throws(() => replayCollections(history, "00", "02"), /registry/);
  history.receipts.pop();
  assert.equal(replayCollections(history, "00", "02")[0].gross, 100n);
});

test("counts purchased packages by recorded funding, approval and cancellation", () => {
  const purchase = {
    kind: "extension",
    price: 101n,
    approvedAt: "02",
    funding: [
      { at: "01", amount: 50n },
      { at: "03", amount: 1n },
    ],
  };
  assert.equal(purchaseDate(purchase, "03"), null);
  assert.equal(purchaseDate(purchase, "04"), "03");
  assert.equal(purchaseDate({ ...purchase, cancelledAt: "03" }, "04"), null);
  assert.equal(purchaseDate({ ...purchase, kind: "online" }, "04"), null);
  assert.equal(purchaseDate({ ...purchase, kind: "walkin" }, "04"), "03");
});

test("reserves explicit allocations before earlier fallback without duplicating attribution", () => {
  const result = replayCollections(
    {
      items: [{ id: "i", reservation: "r", category: "standard", at: "00" }],
      charges: [{ id: "charge", item: "i", at: "00", amount: 100n }],
      receipts: [
        { id: "one", reservation: "r", item: "i", at: "01", amount: 100n },
        { id: "two", reservation: "r", item: "i", at: "02", amount: 100n },
      ],
      allocations: [
        { receipt: "two", item: "i", charge: "charge", at: "02", amount: 100n },
      ],
      refunds: [],
    },
    "00",
    "03",
  );
  assert.deepEqual(
    result.map((part) => [part.charge, part.gross]),
    [
      [null, 100n],
      ["charge", 100n],
    ],
  );
  assert.equal(
    purchaseDate(
      {
        kind: "walkin",
        price: 100n,
        approvedAt: "04",
        funding: [{ at: "02", amount: 50n }],
      },
      "03",
    ),
    "02",
  );
});
