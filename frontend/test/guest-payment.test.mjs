import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/payment-preview",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, waitFor, cleanup } =
  await import("@testing-library/react");
const { PaymentPanel } = await import("../src/GuestPayment.tsx");
afterEach(cleanup);
const now = Date.UTC(2026, 10, 19, 5);
const session = {
  reservationId: "test",
  amountDueCentavos: 270000,
  serverNow: new Date(now).toISOString(),
  proofDeadlineAt: new Date(now + 24 * 60000).toISOString(),
  status: "awaiting_proof",
  qrUrl: null,
  payeeLabel: null,
  emailReminderAt: [
    new Date(now + 15 * 60000).toISOString(),
    new Date(now + 25 * 60000).toISOString(),
  ],
  emailDeliveryEnabled: false,
};

test("O02 preview requires screenshot and reference, then shows pending staff verification only", async () => {
  let submitted;
  render(
    createElement(PaymentPanel, {
      session,
      preview: true,
      onSubmit: async (reference, file) => {
        submitted = { reference, file };
      },
    }),
  );
  assert.ok(screen.getByText("₱2,700.00"));
  assert.ok(screen.getByText(/Five-minute reminder/));
  assert.match(screen.getByText(/Proof deadline/).textContent, /PM/);
  const form = screen
    .getByRole("button", { name: "Preview proof submission" })
    .closest("form");
  fireEvent.submit(form);
  assert.ok(screen.getByRole("alert"));
  fireEvent.change(screen.getByLabelText("Transaction reference"), {
    target: { value: " TEST-REF " },
  });
  fireEvent.change(
    screen.getByLabelText("Payment screenshot (PNG/JPEG, up to 5 MB)"),
    {
      target: {
        files: [
          new dom.window.File(["sample"], "sample.png", { type: "image/png" }),
        ],
      },
    },
  );
  fireEvent.submit(form);
  await waitFor(() =>
    assert.ok(
      screen.getByRole("heading", {
        name: "Payment submitted — awaiting staff verification",
      }),
    ),
  );
  assert.equal(submitted.reference, "TEST-REF");
  assert.equal(submitted.file.name, "sample.png");
  assert.ok(screen.getByText(/does not confirm a booking/));
  assert.equal(
    screen.queryByRole("button", { name: "Preview proof submission" }),
    null,
  );
});

test("expired O02 session offers reconciliation and no submission form", () => {
  render(
    createElement(PaymentPanel, {
      session: { ...session, status: "expired" },
      onSubmit: async () => {
        throw new Error("must not submit");
      },
    }),
  );
  assert.ok(screen.getByText(/contact staff for reconciliation/));
  assert.equal(screen.queryByLabelText("Transaction reference"), null);
});

test("unconfigured real QR keeps proof submission disabled", () => {
  render(createElement(PaymentPanel, { session, onSubmit: async () => {} }));
  assert.equal(
    screen.getByLabelText("Transaction reference").closest("fieldset").disabled,
    true,
  );
  assert.ok(
    screen.getByText("Payment QR is not configured. Do not send payment."),
  );
});
