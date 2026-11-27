import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import express from "express";
import {
  closeStaffNavEvents,
  registerStaffNavEvents,
} from "../src/staff-nav-events.ts";

test("isolated event stream gates staff access, delivers successful writes and closes cleanly", async () => {
  const app = express();
  registerStaffNavEvents(app, (req, res, next) => {
    if (req.header("authorization") === "Bearer staff-test") next();
    else res.sendStatus(403);
  });
  app.post("/staff/check-ins/:id", (req, res) =>
    res.sendStatus(req.params.id === "valid" ? 204 : 400),
  );
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const abort = new globalThis.AbortController();
  try {
    const path = base + "/staff/dashboard/events";
    const denied = await globalThis.fetch(path);
    assert.equal(denied.status, 403);
    await denied.text();
    const response = await globalThis.fetch(path, {
      headers: { Authorization: "Bearer staff-test" },
      signal: globalThis.AbortSignal.any([
        abort.signal,
        globalThis.AbortSignal.timeout(5_000),
      ]),
    });
    const reader = response.body
      .pipeThrough(new globalThis.TextDecoderStream())
      .getReader();
    assert.equal((await reader.read()).value, "data: connected\n\n");
    const next = reader.read();
    assert.equal(
      (
        await globalThis.fetch(base + "/staff/check-ins/invalid", {
          method: "POST",
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await globalThis.fetch(base + "/staff/check-ins/valid", {
          method: "POST",
        })
      ).status,
      204,
    );
    assert.equal((await next).value, "data: stay\n\n");
    closeStaffNavEvents(app);
    assert.equal((await reader.read()).done, true);
  } finally {
    abort.abort();
    closeStaffNavEvents(app);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
