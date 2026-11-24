import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff/walkins",
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
const { default: WalkInDesk } = await import("../src/WalkInDesk.tsx");
const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});
test("real walk-in controls disclose policy and submit contact with metadata without ID material", async () => {
  let captured;
  globalThis.fetch = async (url, options = {}) => {
    if (url.endsWith("/catalog"))
      return {
        ok: true,
        json: async () => [
          {
            code: "double_standard",
            name: "Double Standard",
            duration_minutes: 180,
            price_centavos: 20000,
          },
        ],
      };
    if (url.endsWith("/quote")) {
      const items = JSON.parse(options.body).items;
      return {
        ok: true,
        json: async () => ({
          items: items.map((item) => ({
            ...item,
            endAt: new Date(
              Date.parse(item.startAt) + 180 * 60000,
            ).toISOString(),
            totalCentavos: 20000,
            packages: [],
            baseCentavos: 20000,
            extraBedCentavos: 0,
            advisory: [],
          })),
          totalCentavos: 20000,
        }),
      };
    }
    if (options.method === "POST") {
      captured = JSON.parse(options.body);
      return {
        ok: false,
        json: async () => ({ error: "Synthetic response uncertainty" }),
      };
    }
    return {
      ok: true,
      json: async () => ({
        bookings: [],
        hasMore: false,
        writesEnabled: true,
        policy: {
          version: "booking-v1",
          text: "Synthetic no-smoking policy",
          pendingOwnerApproval: true,
        },
      }),
    };
  };
  render(createElement(WalkInDesk, { token: "staff" }));
  fireEvent.change(await screen.findByLabelText("Primary guest name"), {
    target: { value: "Synthetic guest" },
  });
  fireEvent.change(screen.getByLabelText("Primary contact phone"), {
    target: { value: "09170000000" },
  });
  const showPolicies = screen.getByRole("button", { name: "Show booking policies" });
  assert.equal(showPolicies.getAttribute("aria-expanded"), "false");
  assert.equal(globalThis.document.getElementById(showPolicies.getAttribute("aria-controls")).hidden, true);
  fireEvent.click(showPolicies);
  const hidePolicies = screen.getByRole("button", {
    name: "Hide booking policies",
  });
  assert.ok(screen.getByText(/Collect at least 50% before normal room access/));
  const policyContent = globalThis.document.getElementById(
    hidePolicies.getAttribute("aria-controls"),
  );
  assert.equal(policyContent.querySelector("details").open, false);
  assert.match(policyContent.textContent, /Synthetic no-smoking policy/);
  fireEvent.click(hidePolicies);
  assert.equal(policyContent.hidden, true);
  fireEvent.click(
    screen.getByLabelText(
      "Guest has acknowledged the disclosed booking policy",
    ),
  );
  assert.equal(
    screen.getByLabelText("Guest has acknowledged the disclosed booking policy")
      .checked,
    true,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Show booking policies" }),
  );
  assert.equal(policyContent.hidden, false);
  assert.equal(
    screen.getByLabelText("Guest has acknowledged the disclosed booking policy")
      .checked,
    true,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Calculate server quote" }),
  );
  await waitFor(() =>
    assert.equal(
      screen.getByRole("button", { name: "Create walk-in" }).disabled,
      false,
    ),
  );
  fireEvent.click(screen.getByRole("button", { name: "Create walk-in" }));
  await waitFor(() => assert.ok(captured));
  assert.equal(captured.contact.phone, "09170000000");
  assert.equal(captured.contact.policyVersion, "booking-v1");
  assert.equal(captured.contact.policyAcknowledged, true);
  assert.equal(captured.contact.minorIdStatus, "no_minors");
  assert.equal(
    Object.keys(captured.contact).some((key) =>
      /photo|birth|idNumber/.test(key),
    ),
    false,
  );
});
