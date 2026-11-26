import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/staff/settings",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup, fireEvent } =
  await import("@testing-library/react");
const { default: OperationalSettings } =
  await import("../src/OperationalSettings.tsx");

test("operational settings show and save one checkout reminder", async (t) => {
  t.after(cleanup);
  const settings = {
    cleaningBufferMinutes: 15,
    checkoutAlertMinutes: 30,
    gcashQrObjectKey: null,
    gcashPayeeLabel: null,
    cancellationDisplayText: "Existing cancellation wording",
  };
  const saved = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (options.method === "PUT") saved.push(JSON.parse(options.body));
    return {
      ok: true,
      json: async () => (url.endsWith("/staff/settings") ? settings : {}),
    };
  });
  render(createElement(OperationalSettings, { token: "synthetic-staff" }));

  const input = await screen.findByRole("spinbutton", {
    name: "Checkout reminder (minutes before checkout)",
  });
  const save = screen.getByRole("button", { name: "Save settings" });
  assert.equal(input.value, "30");
  assert.equal(screen.queryByText(/reminders list is empty/), null);
  assert.equal(screen.queryByRole("button", { name: "Use 30, 15, 5" }), null);
  assert.equal(screen.queryByText(/Time set aside for cleaning/), null);

  fireEvent.change(input, { target: { value: "0" } });
  fireEvent.click(save);
  assert.equal(saved.length, 0);

  fireEvent.change(input, { target: { value: "15" } });
  fireEvent.click(save);
  await screen.findByText("Operational settings saved and audited.");
  assert.deepEqual(saved, [{ ...settings, checkoutAlertMinutes: 15 }]);

  fireEvent.change(input, { target: { value: "" } });
  fireEvent.click(save);
  await screen.findByText("Operational settings saved and audited.");
  assert.deepEqual(saved[1], { ...settings, checkoutAlertMinutes: null });
});
