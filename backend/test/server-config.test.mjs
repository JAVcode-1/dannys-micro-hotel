import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { test } from "node:test";
import { URL } from "node:url";

test("API reports an actionable error for an invalid PORT", () => {
  const result = spawnSync(process.execPath, ["dist/server.js"], {
    cwd: new URL("../", import.meta.url),
    env: { ...process.env, PORT: "not-a-port" },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PORT must be an integer between 1 and 65535/);
});
