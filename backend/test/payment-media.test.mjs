import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";

test("payment media accepts bounded PNG/JPEG only and reference is mandatory", async () => {
  const { validatePaymentImage, validateReference } =
    await import("../dist/payment-media.js");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aV1cAAAAASUVORK5CYII=",
    "base64",
  );
  assert.equal(validatePaymentImage(png, "image/png"), "png");
  for (const [bytes, mime] of [
    [png, "image/jpeg"],
    [Buffer.from("<svg></svg>"), "image/svg+xml"],
    [Buffer.alloc(5 * 1024 * 1024 + 1), "image/png"],
    [Buffer.alloc(0), "image/png"],
  ])
    assert.throws(() => validatePaymentImage(bytes, mime));
  assert.throws(() => validateReference(" "));
  assert.throws(() => validateReference("bad\nreference"));
  assert.equal(validateReference("  TEST-REF-123  "), "TEST-REF-123");
});
