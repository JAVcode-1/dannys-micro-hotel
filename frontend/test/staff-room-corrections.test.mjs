/* global fetch */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff/rooms",
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
const { default: StaffRooms } = await import("../src/StaffRooms.tsx");
const { default: Panel } = await import("../src/RoomMaintenancePanel.tsx");
const original = fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = original;
});
const room = {
  id: "1",
  code: "SYNTHETIC LEGACY",
  category_code: "double_standard",
  category_name: "Double Standard",
  active: true,
  operational_state: "ready",
  physically_ready: false,
  legacy_inspection_eligible: true,
  housekeeping_enabled: true,
  housekeeping: [],
  held_now: 0,
  reserved_now: 0,
  available_now: false,
};

test("current inspection requires explicit physical checks and sends audited evidence", async () => {
  let sent;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") {
      sent = JSON.parse(options.body);
      return { ok: true, json: async () => ({}) };
    }
    return { ok: true, json: async () => [room] };
  };
  render(createElement(StaffRooms, { token: "staff" }));
  const button = await screen.findByRole("button", {
    name: "Inspect and mark Ready",
  });
  fireEvent.click(button);
  assert.equal(sent, undefined);
  assert.ok(screen.getByRole("alert"));
  fireEvent.change(
    screen.getByLabelText("Administration or inspection reason"),
    { target: { value: "Synthetic current inspection of clean room" } },
  );
  fireEvent.click(button);
  assert.equal(sent, undefined);
  fireEvent.click(
    screen.getByLabelText(/I physically inspected this room now/),
  );
  fireEvent.click(button);
  await waitFor(() => assert.equal(sent?.checksConfirmed, true));
  assert.equal(sent.note, "Synthetic current inspection of clean room");
  assert.ok(sent.requestKey);
});

test("maintenance reassignment selects a real same-category target and preserves exact command on retry", async () => {
  const affected = {
    ...room,
    operational_state: "maintenance",
    maintenance_now: true,
    maintenance: {
      enabled: true,
      activeBlockId: "4",
      events: [],
      affected: [
        {
          itemId: "11111111-1111-4111-8111-111111111111",
          paid: true,
          state: "confirmed",
          startAt: "2027-01-01",
          endAt: "2027-01-02",
        },
      ],
    },
  };
  const target = {
    ...room,
    id: "2",
    code: "SYNTHETIC REPLACEMENT",
    physically_ready: true,
  };
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return calls.length === 1
      ? { ok: false, json: async () => ({ error: "Synthetic lost response" }) }
      : { ok: true, json: async () => ({}) };
  };
  render(
    createElement(Panel, {
      room: affected,
      rooms: [affected, target],
      token: "staff",
      refresh: async () => {},
      time: (x) => x,
      busy: false,
    }),
  );
  fireEvent.change(screen.getByLabelText("Replacement Ready room"), {
    target: { value: "2" },
  });
  fireEvent.change(screen.getByLabelText("Maintenance note"), {
    target: { value: "Synthetic approved alternative" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Reassign room item" }));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Reassign room item" }));
  await waitFor(() => assert.equal(calls.length, 2));
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].url, "/api/staff/rooms/1/reassign");
  assert.equal(calls[0].body.targetRoomId, "2");
});
