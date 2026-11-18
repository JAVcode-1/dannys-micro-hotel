import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBookingItems, priceBooking } from "../dist/booking-quote.js";

const now = Date.UTC(2026, 10, 18);
const standard = {
  category: "double_standard",
  startAt: "2027-01-01T01:00:00+08:00",
  blocks: [180],
  adults: 2,
  children: 0,
  extraBed: false,
};
const family = {
  category: "family_executive",
  startAt: "2027-01-02T02:00:00+08:00",
  blocks: [1440, 1440],
  adults: 5,
  children: 1,
  extraBed: true,
};
const catalog = [
  {
    id: "1",
    category: "double_standard",
    duration_minutes: 180,
    price_centavos: "20000",
    version: 1,
  },
  {
    id: "7",
    category: "family_executive",
    duration_minutes: 1440,
    price_centavos: "120000",
    version: 1,
  },
];

test("T28 mixed schedules and explicit blocks quote full amount and one Family bed", () => {
  const quote = priceBooking(
    parseBookingItems([standard, family], now),
    catalog,
  );
  assert.equal(quote.totalCentavos, 270000);
  assert.equal(quote.items[0].startAt, "2026-12-31T17:00:00.000Z");
  assert.equal(quote.items[0].endAt, "2026-12-31T20:00:00.000Z");
  assert.equal(quote.items[1].endAt, "2027-01-03T18:00:00.000Z");
  assert.equal(quote.items[1].extraBedCentavos, 10000);
  assert.ok(quote.items[1].advisory);
  catalog[1].price_centavos = "130000";
  assert.equal(quote.items[1].packages[0].priceCentavos, 120000);
  catalog[1].price_centavos = "120000";
});

test("invalid category packages, past/normalized dates, occupancy and Standard extra bed are rejected", () => {
  for (const item of [
    { ...family, blocks: [180] },
    { ...standard, extraBed: true },
    { ...standard, adults: 0 },
    { ...standard, children: -1 },
    { ...standard, blocks: [] },
    { ...standard, blocks: [60] },
    { ...standard, startAt: "2026-01-01T01:00:00Z" },
    { ...standard, startAt: "2027-02-30T01:00:00+08:00" },
    { ...standard, startAt: "2027-01-01T01:00:00" },
    null,
  ])
    assert.throws(() => parseBookingItems([item], now));
  assert.throws(() => parseBookingItems([], now));
  assert.throws(() => parseBookingItems(Array(16).fill(standard), now));
});

test("quotes ignore browser price and reject missing packages or unsafe database money", () => {
  const items = parseBookingItems([{ ...standard, totalCentavos: 1 }], now);
  assert.equal(priceBooking(items, catalog).totalCentavos, 20000);
  assert.throws(() => priceBooking(items, []));
  assert.throws(() =>
    priceBooking(items, [
      { ...catalog[0], price_centavos: "9007199254740992" },
    ]),
  );
});
