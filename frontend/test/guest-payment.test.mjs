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
  assert.ok(screen.getByText(/Reminder: submit your screenshot/));
  assert.match(screen.getByText(/Proof deadline/).textContent, /PM/);
  const form = screen
    .getByRole("button", { name: "Preview upload" })
    .closest("form");
  fireEvent.submit(form);
  assert.ok(screen.getByRole("alert"));
  fireEvent.change(screen.getByLabelText("Transaction reference"), {
    target: { value: "0123456789" },
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
        name: "Payment under review",
      }),
    ),
  );
  assert.equal(submitted.reference, "0123456789");
  assert.equal(submitted.file.name, "sample.png");
  assert.ok(screen.getByText(/Your booking is not confirmed yet/));
  assert.equal(screen.queryByRole("button", { name: "Preview upload" }), null);
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

test("confirmed payment never shows an expired proof warning or payment form", () => {
  render(
    createElement(PaymentPanel, {
      session: {
        ...session,
        status: "confirmed",
        proofDeadlineAt: new Date(now - 60000).toISOString(),
      },
      onSubmit: async () => {},
    }),
  );
  assert.ok(screen.getByText("Payment verified"));
  assert.ok(screen.getByText(/current status of each room and event/));
  assert.equal(screen.queryByText(/contact staff for reconciliation/), null);
  assert.equal(screen.queryByLabelText("Transaction reference"), null);
});
