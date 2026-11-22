import assert from "node:assert/strict";
import test from "node:test";
import { parsePesoInput, pesoInputValue } from "../src/peso-input.ts";

test("peso inputs preserve centavos with optional peso sign and grouping", () => {
  for (const [input, expected] of [
    ["₱1,000.00", 100000],
    ["1,250.29", 125029],
    ["0.01", 1],
    [" 19.9 ", 1990],
    ["90071992547409.91", Number.MAX_SAFE_INTEGER],
  ])
    assert.equal(parsePesoInput(input), expected);
  assert.equal(pesoInputValue(125029), "1250.29");
  assert.equal(pesoInputValue(1), "0.01");
  for (const value of ["1,00", "1.001", "1e3", "-1", "", "90071992547409.92"])
    assert.throws(() => parsePesoInput(value), /PHP/);
});
