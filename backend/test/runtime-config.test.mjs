/* global fetch */
import assert from "node:assert/strict";
import process from "node:process";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("configured origin permits PUT/PATCH and varies rejected origins", async () => {
  const original = process.env.STAFF_WEB_ORIGIN;
  process.env.STAFF_WEB_ORIGIN = "http://localhost:5173";
  const server = createApp().listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/staff/settings`;
    const allowed = await fetch(url, {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "PUT",
      },
    });
    assert.equal(allowed.status, 204);
    assert.match(allowed.headers.get("access-control-allow-methods"), /PUT/);
    assert.match(allowed.headers.get("access-control-allow-methods"), /PATCH/);
    const denied = await fetch(url, {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(denied.headers.get("access-control-allow-origin"), null);
    assert.equal(denied.headers.get("vary"), "Origin");
  } finally {
    server.close();
    if (original === undefined) delete process.env.STAFF_WEB_ORIGIN;
    else process.env.STAFF_WEB_ORIGIN = original;
  }
});
