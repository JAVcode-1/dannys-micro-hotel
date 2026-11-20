import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("H03 audit rejects guests and inactive staff, and validates filters before querying", async () => {
  const app = createApp(
    async () => {},
    async (token) => (token === "active" ? { id: "staff" } : null),
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const url = "http://127.0.0.1:" + server.address().port + "/staff/audit";
    for (const [token, status] of [
      ["", 401],
      ["guest", 403],
      ["inactive", 403],
      ["active", 400],
    ]) {
      const response = await globalThis.fetch(url + "?from=2026-02-30", {
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      assert.equal(response.status, status);
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("H03 audit rejects invalid ranges, subject formats, repeated values and malformed cursors", async () => {
  const { parseAuditFilters } = await import("../dist/audit.js");
  for (const invalid of [
    { from: "2026-11-21", to: "2026-11-20" },
    { to: "2025-02-29" },
    { limit: "51" },
    { actor: ["a", "b"] },
    { subjectType: "room", subjectId: "0" },
    { subjectType: "guest" },
    { cursor: "not-an-audit-cursor" },
    { action: "payment proof" },
  ])
    assert.throws(
      () => parseAuditFilters(invalid),
      (error) => error.status === 400,
    );
  assert.equal(
    parseAuditFilters({ from: "2024-02-29", to: "2024-02-29" }).limit,
    25,
  );
});
