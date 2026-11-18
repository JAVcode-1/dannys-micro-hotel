/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("guest identity requires a bearer token and verified server identity", async () => {
  const app = createApp(
    async () => {},
    async () => null,
    async () => {},
    async (token) =>
      token === "verified"
        ? { id: "guest-1", email: "guest@example.test" }
        : null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/guest/me`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Authorization: "Bearer wrong" } })).status,
      403,
    );
    const verified = await fetch(url, {
      headers: { Authorization: "Bearer verified" },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.headers.get("cache-control"), "no-store");
    assert.deepEqual(await verified.json(), {
      id: "guest-1",
      email: "guest@example.test",
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
