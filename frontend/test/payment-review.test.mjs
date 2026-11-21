import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/staff/payment-review-preview",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup, fireEvent, waitFor } =
  await import("@testing-library/react");
const { PaymentReviewPreview: App } =
  await import("../src/StaffPaymentReviews.tsx");
const { PaymentReviewPanel } = await import("../src/StaffPaymentReviews.tsx");
afterEach(cleanup);
test("O03 staff preview is explicitly synthetic and cannot submit live confirmation", () => {
  render(createElement(App));
  assert.ok(screen.getByRole("heading", { name: "Payment review" }));
  assert.ok(screen.getByText(/Synthetic preview/));
  assert.ok(
    screen.getByRole("button", { name: "Confirm verified payment" }).disabled,
  );
});
test("O03 synthetic reconciliation saves locally without confirming or changing independent schedules", async () => {
  render(createElement(App));
  const note = screen.getByLabelText("Review note and guest recovery action");
  fireEvent.change(note, {
    target: { value: "Contact guest to reconcile the recipient mismatch." },
  });
  fireEvent.change(screen.getByLabelText("Review decision"), {
    target: { value: "mismatched" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Preview reconciliation decision" }),
  );
  await waitFor(() =>
    assert.match(
      screen.getByRole("status").textContent,
      /No payment or booking was changed/,
    ),
  );
  assert.ok(screen.getByText("Payment mismatch", { selector: "dd" }));
  assert.ok(screen.getByText(/Dec 1, 2026, 2:00 PM/));
  assert.ok(screen.getByText(/Dec 2, 2026, 4:00 PM/));
});
test("O03 manual checks and Manila received time are required; uncertain retries reuse the request key", async () => {
  const payloads = [];
  const review = {
    id: "test",
    reservationId: "test-reservation",
    primaryName: "TEST GUEST",
    transactionReference: "TEST-REF",
    amountDueCentavos: 20000,
    submittedAt: "2026-11-19T05:00:00Z",
    status: "pending_review",
    version: 2,
    age: "overdue",
    duplicateReference: false,
    items: [],
  };
  render(
    createElement(PaymentReviewPanel, {
      review,
      confirmationEnabled: true,
      onProof: async () => ({
        url: "https://example.test/private",
        expiresIn: 120,
      }),
      onDecision: async (value) => {
        payloads.push(value);
        throw new Error("Uncertain network result. Retry unchanged.");
      },
    }),
  );
  fireEvent.change(screen.getByLabelText("Review decision"), {
    target: { value: "confirmed" },
  });
  const button = screen.getByRole("button", {
    name: "Confirm verified payment",
  });
  assert.ok(button.disabled);
  for (const checkbox of screen.getAllByRole("checkbox"))
    fireEvent.click(checkbox);
  for (const [label, value] of [
    ["Ledger reference", "TEST-REF"],
    ["Receiving payee label", "TEST PAYEE"],
    ["Received amount (PHP)", "200.00"],
    ["Received date (Manila)", "2026-11-19"],
    ["Received hour", "1"],
    ["Received minute", "05"],
    ["Received AM or PM", "PM"],
    ["Review note and guest recovery action", "Ledger manually checked."],
  ])
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  fireEvent.click(button);
  await waitFor(() =>
    assert.match(screen.getByRole("status").textContent, /Uncertain network/),
  );
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].verification.receivedAt, "2026-11-19T05:05:00.000Z");
  assert.equal(payloads[0].verification.amountCentavos, 20000);
  assert.equal(payloads[0].expectedVersion, 2);
  fireEvent.click(button);
  await waitFor(() => assert.equal(payloads.length, 2));
  assert.equal(payloads[1].requestKey, payloads[0].requestKey);
  await waitFor(() => assert.equal(button.disabled, false));
});
