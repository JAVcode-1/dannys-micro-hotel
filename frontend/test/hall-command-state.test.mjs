import assert from "node:assert/strict";
import test from "node:test";
import { btoa } from "node:buffer";
import { pendingHallCommand, hallCentavos } from "../src/hall-command-state.ts";

test("Hall peso input preserves exact centavos and rejects unsupported precision", () => {
  assert.equal(hallCentavos("1500.25"), 150025);
  assert.equal(hallCentavos("0.01"), 1);
  for (const input of ["1.001", "1e3", "-5", "", "9007199254740991"])
    assert.throws(() => hallCentavos(input), /PHP/);
});

test("hall retry persists exact command across reload and isolates staff subjects", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const token = (sub) =>
    "header." + btoa(JSON.stringify({ sub })) + ".signature";
  const command = {
    path: "actions/receipt",
    payload: '{"amount":500}',
    key: "retry-command-0001",
  };
  pendingHallCommand(storage, token("staff-a")).save(command);
  assert.deepEqual(
    pendingHallCommand(storage, token("staff-a")).load(),
    command,
  );
  assert.equal(pendingHallCommand(storage, token("staff-b")).load(), undefined);
  pendingHallCommand(storage, token("staff-a")).clear();
  assert.equal(pendingHallCommand(storage, token("staff-a")).load(), undefined);
});

test("hall retry rejects corrupted persisted commands", () => {
  const storage = {
    getItem: () => '{"path":"../settings","key":"x"}',
    setItem() {},
    removeItem() {},
  };
  const token =
    "header." + btoa(JSON.stringify({ sub: "staff-a" })) + ".signature";
  assert.equal(pendingHallCommand(storage, token).load(), undefined);
});
