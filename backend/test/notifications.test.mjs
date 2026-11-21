import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeMailAdapter, retryDelay } from "../dist/notifications.js";
test("notification retries are bounded and fake delivery deduplicates lost-response retries", async () => {
  assert.equal(retryDelay(1), 60000);
  assert.equal(retryDelay(5), 960000);
  assert.throws(() => retryDelay(0));
  assert.throws(() => retryDelay(6));
  const mail = new FakeMailAdapter();
  const message = {
    id: "test-message",
    to: "guest@example.test",
    kind: "reservation_created",
    payload: { reservationId: "fixture" },
  };
  await mail.deliver(message);
  await mail.deliver(message);
  assert.equal(mail.messages.length, 1);
  await assert.rejects(
    mail.deliver({ ...message, to: "different@example.test" }),
    /idempotency/i,
  );
});
