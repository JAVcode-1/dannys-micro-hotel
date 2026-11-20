import assert from "node:assert/strict";
import test from "node:test";
import { calculateAnalytics } from "../dist/analytics-report.js";
import { exportAnalytics } from "../dist/analytics-export.js";

const from = "2026-11-15T16:00:00.000000Z";
const end = "2026-11-16T16:00:00.000000Z";
const item = {
  id: "i",
  reservation: "r",
  category: " =formula",
  at: from,
  confirmation: from,
  check_in: null,
  cancellation: null,
  channel: "online",
  total: "101",
  base: "100",
  extra: "1",
  snapshot: [{ id: 1, version: 2, durationMinutes: 180, priceCentavos: 100 }],
};
const payment = {
  id: "online:p",
  reservation_id: "r",
  item: null,
  at: from,
  recorded: from,
  amount: "101",
  reference: "synthetic",
  registry_ok: true,
};
const rows = {
  items: [item],
  payments: [payment],
  registry: new Map([["synthetic", "online:p"]]),
  refunds: [],
  extensions: [],
  allocations: [],
  extras: [],
};

test("reconciles gross, package and additional charges and buckets Manila Monday", () => {
  const report = calculateAnalytics(rows, from, end, "week");
  assert.deepEqual(report.overall, { gross: "101", refunds: "0", net: "101" });
  assert.equal(report.trends[0].period, "2026-11-16");
  assert.equal(report.categories[0].additional.net, "1");
  assert.equal(report.categories[0].packages.net, "100");
  assert.equal(report.packages[0].originals, 1);
  assert.equal(report.packages[0].net, "100");
  assert.equal(
    calculateAnalytics(rows, from, end, "day", "missing").overall.net,
    "101",
  );
  assert.equal(
    calculateAnalytics(rows, from, end, "day", "missing").packages.length,
    0,
  );
});

test("generates safe CSV labels and a genuine ZIP workbook", async () => {
  const report = calculateAnalytics(rows, from, end, "day");
  const csv = await exportAnalytics(report, "csv");
  const xlsx = await exportAnalytics(report, "xlsx");
  assert.match(csv.toString(), /"' =formula"/);
  assert.equal(xlsx.subarray(0, 4).toString("hex"), "504b0304");
});

test("preserves missing package history in the known category's allocation weight", () => {
  const first = {
    ...item,
    id: "a",
    category: "unknown-history",
    snapshot: [],
    extra: "0",
    total: "200",
  };
  const second = {
    ...item,
    id: "b",
    category: "known-history",
    extra: "0",
    total: "200",
  };
  const report = calculateAnalytics(
    {
      ...rows,
      items: [first, second],
      payments: [{ ...payment, amount: "100" }],
    },
    from,
    end,
    "day",
  );
  assert.deepEqual(
    report.categories.map((r) => [r.name, r.net, r.unclassified.net]),
    [
      ["unknown-history", "50", "50"],
      ["known-history", "50", "0"],
    ],
  );
});
