import assert from "node:assert/strict";
import { publicCatalog } from "../backend/dist/catalog.js";
import { closeDatabase } from "../backend/dist/database.js";

const expected = [
  ["double_standard", 180, 20000],
  ["double_standard", 360, 40000],
  ["double_standard", 720, 60000],
  ["double_standard", 1440, 100000],
  ["family_executive", 360, 60000],
  ["family_executive", 720, 90000],
  ["family_executive", 1440, 120000],
];
const url = new URL(process.env.SUPABASE_URL);
assert.equal(url.hostname, "pgbierfxeviouyjsmjnh.supabase.co");
try {
  const rows = await publicCatalog();
  assert.deepEqual(
    rows.map((row) => [
      row.code,
      row.duration_minutes,
      Number(row.price_centavos),
    ]),
    expected,
  );
  console.log(
    "C01 hosted active catalog: 7 approved packages and rates verified",
  );
} finally {
  await closeDatabase();
}
