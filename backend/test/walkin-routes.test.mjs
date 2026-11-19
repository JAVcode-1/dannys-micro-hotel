/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
test("W01 denies guests and revoked staff; live booking and ledger writes remain closed", async () => {
  let active = true;
  const app = createApp(
    async () => {},
    async (token) =>
      token === "staff" && active
        ? { id: "11111111-1111-4111-8111-111111111111", email: null }
        : null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/staff/walkins`;
    for (const [path, method] of [
      ["", "GET"],
      ["", "POST"],
      ["/quote", "POST"],
      ["/11111111-1111-4111-8111-111111111111/payments", "POST"],
    ]) {
      assert.equal((await fetch(base + path, { method })).status, 401);
      assert.equal(
        (
          await fetch(base + path, {
            method,
            headers: { Authorization: "Bearer guest" },
          })
        ).status,
        403,
      );
    }
    for (const path of ["", "/11111111-1111-4111-8111-111111111111/payments"])
      assert.equal(
        (
          await fetch(base + path, {
            method: "POST",
            headers: { Authorization: "Bearer staff" },
          })
        ).status,
        503,
      );
    active = false;
    assert.equal(
      (await fetch(base, { headers: { Authorization: "Bearer staff" } }))
        .status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
