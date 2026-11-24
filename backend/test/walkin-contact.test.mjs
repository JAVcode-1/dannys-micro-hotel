import assert from "node:assert/strict";
import { test } from "node:test";
import { parseWalkInContact, walkInPolicy } from "../dist/walkins.js";
test("walk-in contact requires policy and stores only minor verification metadata", () => {
  const input = {
    phone: "09170000000",
    email: "GUEST@example.test",
    policyVersion: walkInPolicy.version,
    policyAcknowledged: true,
    minorIdStatus: "not_checked",
  };
  assert.equal(parseWalkInContact(input).email, "guest@example.test");
  for (const invalid of [
    { ...input, phone: "" },
    { ...input, policyAcknowledged: false },
    { ...input, policyVersion: "obsolete-policy" },
    { ...input, minorIdStatus: "legally_eligible" },
    { ...input, idPhoto: "data:image/png" },
    { ...input, email: "invalid" },
  ])
    assert.throws(() => parseWalkInContact(invalid));
});
