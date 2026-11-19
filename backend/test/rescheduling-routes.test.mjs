/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";
test("X02 authorization and normal registration keep reschedule writes closed", async () => {
  const guest = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "owner@example.test",
  };
  const app = createApp(
    async () => {},
    async (token) =>
      token === "staff"
        ? { id: "33333333-3333-4333-8333-333333333333", email: null }
        : null,
    async () => {},
    async (token) => (token === "guest" ? guest : null),
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const path of [
      "/staff/reschedules",
      "/staff/reschedules/" + guest.id + "/decision",
      "/staff/reschedules/" + guest.id + "/request",
    ]) {
      const method = path === "/staff/reschedules" ? "GET" : "POST";
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
      if (method === "POST")
        assert.equal(
          (
            await fetch(base + path, {
              method,
              headers: { Authorization: "Bearer staff" },
            })
          ).status,
          503,
        );
    }
    const path = "/guest/reschedules/" + guest.id;
    assert.equal((await fetch(base + path, { method: "POST" })).status, 401);
    const res = await fetch(base + path, {
      method: "POST",
      headers: { Authorization: "Bearer guest" },
    });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get("cache-control"), "no-store");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
