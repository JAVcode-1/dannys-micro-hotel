/* global fetch */
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { app } from "../dist/app.js";

const server = app.listen(0);
after(() => server.close());

test("GET /health returns a healthy JSON response", async () => {
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});
