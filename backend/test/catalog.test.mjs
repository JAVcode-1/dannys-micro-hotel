import assert from "node:assert/strict";
import { test } from "node:test";
import { changePackagePrice } from "../dist/catalog.js";

test("unsupported Family 3-hour and unsafe prices are rejected before database access", async () => {
  for (const [code, duration, price] of [
    ["family_executive", 180, 20000],
    ["double_standard", 180, -1],
    ["double_standard", 180, 1.5],
    ["unknown", 360, 10000],
  ])
    assert.equal(
      await changePackagePrice("staff", code, duration, price),
      false,
    );
});
