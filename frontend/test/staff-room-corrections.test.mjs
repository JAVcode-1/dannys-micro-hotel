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
const { render, screen, cleanup, fireEvent, waitFor, within } =
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

test("inactive rooms show their booking status even after they are physically ready", async () => {
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      {
        ...room,
        active: false,
        physically_ready: true,
        legacy_inspection_eligible: false,
        maintenance: { enabled: true, events: [], affected: [] },
      },
    ],
  });
  render(createElement(StaffRooms, { token: "staff" }));
  assert.ok(await screen.findByText("Inactive"));
  assert.ok(screen.getByText("Unavailable for booking"));
  assert.equal(screen.queryByText("Ready"), null);
  assert.ok(screen.getByText("Maintenance details"));
  assert.equal(screen.queryByText("Room setup"), null);
});

test("an active ready room only gets the Ready badge when available", async () => {
  const ready = {
    ...room,
    physically_ready: true,
    legacy_inspection_eligible: false,
  };
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      { ...ready, code: "Synthetic reserved room", reserved_now: 1 },
      {
        ...ready,
        id: "2",
        code: "Synthetic available room",
        available_now: true,
      },
    ],
  });
  render(createElement(StaffRooms, { token: "staff" }));
  const reserved = within(
    (
      await screen.findByRole("heading", { name: "Synthetic reserved room" })
    ).closest("article"),
  );
  const available = within(
    screen
      .getByRole("heading", { name: "Synthetic available room" })
      .closest("article"),
  );
  assert.ok(reserved.getByText("Unavailable"));
  assert.ok(reserved.getByText("Reserved capacity: 1"));
  assert.equal(reserved.queryByText("Ready"), null);
  assert.ok(available.getByText("Ready"));
  assert.ok(available.getByText("Available now"));
});

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
  fireEvent.click(await screen.findByText("Inspect room"));
  const button = await screen.findByRole("button", {
    name: "Inspect and mark Ready",
  });
  fireEvent.click(button);
  assert.equal(sent, undefined);
  assert.ok(screen.getByRole("alert"));
  fireEvent.change(screen.getByLabelText("Inspection note"), {
    target: { value: "Synthetic current inspection of clean room" },
  });
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

test("an inactive Ready room can be inspected and activated through its own card", async (t) => {
  const inactive = {
    ...room,
    active: false,
    legacy_inspection_eligible: false,
  };
  const commands = [];
  let inspected = false;
  let active = false;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.endsWith("/staff/rooms")) {
      return {
        ok: true,
        json: async () => [{ ...inactive, active, available_now: active }],
      };
    }
    const body = JSON.parse(options.body);
    commands.push({ url, method: options.method, body });
    if (url.endsWith("/inspection")) {
      inspected = true;
      return { ok: true };
    }
    if (!inspected) {
      return {
        ok: false,
        status: 409,
        json: async () => ({
          error: "Inspect and mark the room Ready before activation.",
        }),
      };
    }
    active = true;
    return { ok: true };
  });

  render(createElement(StaffRooms, { token: "staff" }));
  fireEvent.click(await screen.findByText("Booking activation"));
  const activate = screen.getByRole("button", { name: "Activate for booking" });
  fireEvent.change(screen.getByLabelText("Activation reason"), {
    target: { value: "Synthetic room returning to service" },
  });
  fireEvent.click(activate);
  const inspect = await screen.findByRole("button", {
    name: "Inspect and mark Ready",
  });
  assert.equal(inspect.closest("details").open, true);
  assert.equal(screen.queryByText("Available now"), null);

  fireEvent.change(screen.getByLabelText("Inspection note"), {
    target: { value: "Synthetic inspection completed" },
  });
  fireEvent.click(
    screen.getByLabelText(/I physically inspected this room now/),
  );
  fireEvent.click(inspect);
  await screen.findByText(/Inspection saved/);
  fireEvent.click(activate);

  assert.ok(await screen.findByText("Available now"));
  assert.equal(commands.length, 3);
  assert.ok(commands[0].url.endsWith(`/staff/rooms/${inactive.id}/admin`));
  assert.equal(commands[0].method, "PATCH");
  assert.ok(commands[0].body.requestKey);
  assert.deepEqual(commands[0].body, {
    active: true,
    note: "Synthetic room returning to service",
    requestKey: commands[0].body.requestKey,
  });
  assert.equal(commands[1].method, "POST");
  assert.equal(commands[1].body.checksConfirmed, true);
  assert.deepEqual(commands[2], commands[0]);
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
