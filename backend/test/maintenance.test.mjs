import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../dist/app.js";

test("H02 denies unauthorized maintenance actions and keeps live changes closed", async () => {
  const app = createApp(
    async () => {},
    async (token) => (token === "staff" ? { id: "actor" } : null),
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const url =
      "http://127.0.0.1:" +
      server.address().port +
      "/staff/rooms/1/maintenance";
    for (const [token, status] of [
      ["", 401],
      ["guest", 403],
      ["staff", 503],
    ]) {
      const response = await globalThis.fetch(url, {
        method: "POST",
        headers: token ? { Authorization: "Bearer " + token } : {},
      });
      assert.equal(response.status, status);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
