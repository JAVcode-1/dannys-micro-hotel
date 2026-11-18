/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("physical room endpoint denies guests and invalid tokens", async () => {
  const app = createApp(
    async () => {},
    async () => null,
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}/staff/rooms`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal(
      (await fetch(url, { headers: { Authorization: "Bearer guest" } })).status,
      403,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
