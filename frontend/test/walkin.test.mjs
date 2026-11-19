import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/staff/walkin-preview",
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
const { default: App } = await import("../src/App.tsx");
afterEach(cleanup);
test("W01 synthetic planner is distinct from W02 and cannot check a guest in", () => {
  render(createElement(App));
  assert.ok(screen.getByRole("heading", { name: "Walk-in desk" }));
  assert.ok(screen.getByText(/Synthetic preview/));
  assert.ok(screen.getByRole("button", { name: "Check-in is W02" }).disabled);
});
test("W01 preview journals mixed payments and requires a fresh quote after successful creation", async () => {
  render(createElement(App));
  fireEvent.change(screen.getByLabelText("Primary guest name"), {
    target: { value: "SYNTHETIC GUEST" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Calculate fixture quote" }),
  );
  const create = screen.getByRole("button", {
    name: "Create synthetic walk-in",
  });
  await waitFor(() => assert.equal(create.disabled, false));
  fireEvent.click(create);
  await waitFor(() =>
    assert.ok(screen.getByRole("heading", { name: "SYNTHETIC GUEST" })),
  );
  assert.equal(create.disabled, true);
  fireEvent.change(screen.getByLabelText("Payment amount (PHP)"), {
    target: { value: "100.00" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Record synthetic payment" }),
  );
  await waitFor(() => assert.ok(screen.getByText("Payment minimum met")));
  fireEvent.change(screen.getByLabelText("Method"), {
    target: { value: "gcash" },
  });
  fireEvent.change(screen.getByLabelText("Payment amount (PHP)"), {
    target: { value: "100" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Record synthetic payment" }),
  );
  await waitFor(() =>
    assert.ok(screen.getByText(/Verify actual GCash receipt/)),
  );
  assert.equal(screen.getAllByText("cash").length, 1);
  fireEvent.change(screen.getByLabelText("GCash reference"), {
    target: { value: "SYNTHETIC-REF-123" },
  });
  fireEvent.change(screen.getByLabelText("Receiving payee label"), {
    target: { value: "SYNTHETIC PAYEE" },
  });
  for (const box of screen.getAllByRole("checkbox")) fireEvent.click(box);
  fireEvent.click(
    screen.getByRole("button", { name: "Record synthetic payment" }),
  );
  await waitFor(() => assert.ok(screen.getByText("gcash")));
  assert.ok(screen.getByRole("button", { name: "Check-in is W02" }).disabled);
  assert.equal(
    screen
      .getByRole("button", { name: "Record synthetic payment" })
      .matches(":disabled"),
    true,
  );
});
test("W01 planner preserves independent AM/PM schedules and charges one Family bed across package blocks", async () => {
  render(createElement(App));
  fireEvent.change(screen.getByLabelText("Primary guest name"), {
    target: { value: "SYNTHETIC GROUP" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 1 date"), {
    target: { value: "2027-01-01" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 1 hour"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 1 minute"), {
    target: { value: "00" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 1 AM/PM"), {
    target: { value: "PM" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add room" }));
  fireEvent.change(screen.getByLabelText("Category — room 2"), {
    target: { value: "family_executive" },
  });
  assert.ok(
    ![...screen.getByLabelText("Package 1 — room 2").options].some(
      (option) => option.value === "180",
    ),
  );
  fireEvent.change(screen.getByLabelText("Arrival 2 date"), {
    target: { value: "2027-01-02" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 2 hour"), {
    target: { value: "10" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 2 minute"), {
    target: { value: "00" },
  });
  fireEvent.change(screen.getByLabelText("Arrival 2 AM/PM"), {
    target: { value: "AM" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Add package to room 2" }),
  );
  fireEvent.click(
    screen.getByRole("checkbox", { name: /One Family extra bed/ }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Calculate fixture quote" }),
  );
  await waitFor(() => assert.ok(screen.getByText(/Total ₱1,500.00/)));
  fireEvent.click(
    screen.getByRole("button", { name: "Create synthetic walk-in" }),
  );
  await waitFor(() =>
    assert.ok(screen.getByRole("heading", { name: "SYNTHETIC GROUP" })),
  );
  assert.ok(screen.getByText(/Jan 1, 2027.*2:00 PM/));
  assert.ok(screen.getByText(/Jan 2, 2027.*10:00 AM/));
});
