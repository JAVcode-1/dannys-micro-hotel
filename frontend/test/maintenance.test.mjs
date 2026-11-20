/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup, waitFor } =
  await import("@testing-library/react");
const { default: Panel } = await import("../src/RoomMaintenancePanel.tsx");

test("H02 room panel flags affected paid items and requires explicit Ready confirmation", async () => {
  const original = fetch;
  const room = {
    id: "3",
    active: true,
    operational_state: "maintenance",
    maintenance_now: true,
    maintenance: {
      enabled: false,
      activeBlockId: "5",
      events: [
        {
          id: "6",
          action: "open",
          note: "Inspect fixture",
          actorId: "staff",
          occurredAt: "now",
        },
      ],
      affected: [
        {
          itemId: "item",
          paid: true,
          state: "confirmed",
          startAt: "one",
          endAt: "two",
        },
      ],
    },
  };
  const props = {
    room,
    token: "staff",
    refresh: async () => {},
    time: (s) => s,
    busy: false,
  };
  try {
    const view = render(createElement(Panel, props));
    assert.ok(screen.getByText(/Payment recorded/));
    assert.ok(screen.getByText(/Inspect fixture/));
    assert.equal(
      screen.getByRole("button", { name: "Clear maintenance" }).disabled,
      true,
    );
    room.maintenance.enabled = true;
    view.rerender(createElement(Panel, props));
    let sent;
    globalThis.fetch = async (_url, options) => {
      sent = JSON.parse(options.body);
      return { ok: true };
    };
    fireEvent.change(screen.getByLabelText("Maintenance note"), {
      target: { value: "Inspection completed" },
    });
    fireEvent.click(screen.getByLabelText(/I completed the room checks/));
    fireEvent.click(screen.getByRole("button", { name: "Clear maintenance" }));
    await waitFor(() =>
      assert.equal(screen.getByLabelText("Maintenance note").value, ""),
    );
    assert.equal(sent.action, "clear");
    assert.equal(sent.blockId, "5");
    assert.equal(sent.restoreReady, true);
  } finally {
    globalThis.fetch = original;
    cleanup();
  }
});
