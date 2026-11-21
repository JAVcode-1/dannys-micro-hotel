import assert from "node:assert/strict";
import { test } from "node:test";
import { assertIsolatedTarget } from "../dist/isolated-composition.js";

test("isolated composition rejects hosted, non-test databases and production mode", () => {
  assert.doesNotThrow(() =>
    assertIsolatedTarget(
      { host: "127.0.0.1", database: "staytrack_test" },
      "test",
    ),
  );
  for (const [options, mode] of [
    [{ host: "db.example.com", database: "staytrack_test" }, "test"],
    [{ host: "127.0.0.1", database: "postgres" }, "development"],
    [{ host: "127.0.0.1", database: "staytrack_test" }, "production"],
    [
      {
        host: "127.0.0.1",
        database: "staytrack_test",
        connectionString: "postgres://remote/db",
      },
      "test",
    ],
  ])
    assert.throws(() => assertIsolatedTarget(options, mode), /isolated/i);
});
