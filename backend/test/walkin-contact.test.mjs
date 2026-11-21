import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWalkInContact } from "../dist/walkins.js";
test("walk-in contact requires policy and stores only minor verification metadata", () => {
  const input = {
    phone: "09170000000",
    email: "GUEST@example.test",
    policyVersion: "booking-v1",
    policyAcknowledged: true,
    minorIdStatus: "not_checked",
  };
  assert.equal(parseWalkInContact(input).email, "guest@example.test");
  for (const invalid of [
    { ...input, phone: "" },
    { ...input, policyAcknowledged: false },
    { ...input, minorIdStatus: "legally_eligible" },
    { ...input, idPhoto: "data:image/png" },
    { ...input, email: "invalid" },
  ])
    assert.throws(() => parseWalkInContact(invalid));
});
