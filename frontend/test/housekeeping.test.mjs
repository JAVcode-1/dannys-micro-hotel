/* global fetch */
import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff",
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
const originalFetch = fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

test("H01 session change clears the previous staff board while reloading", async () => {
  let resolve;
  globalThis.fetch = async (_url, options) =>
    options.headers.Authorization === "Bearer first"
      ? { ok: true, json: async () => [room] }
      : new Promise((r) => {
          resolve = r;
        });
  const view = render(createElement(StaffRooms, { token: "first" }));
  await screen.findByText(room.code);
  view.rerender(createElement(StaffRooms, { token: "second" }));
  await waitFor(() => assert.equal(screen.queryByText(room.code), null));
  assert.ok(screen.getByRole("status"));
  resolve({ ok: true, json: async () => [] });
  await screen.findByText(/No physical rooms are configured/);
});
const room = {
  id: "1",
  code: "SYNTHETIC H01",
  category_name: "Double Standard",
  operational_state: "cleaning",
  active: true,
  available_now: false,
  held_now: 1,
  reserved_now: 0,
  maintenance_now: false,
  turnover_until: "2027-01-01T10:00:00Z",
  checkout_id: "11111111-1111-4111-8111-111111111111",
  housekeeping: [],
  housekeeping_enabled: true,
};
test("H01 room board records start, finish, explicit checks and Ready separately from buffer", async () => {
  let stage = 0;
  const posts = [];
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "POST") {
      posts.push(JSON.parse(options.body));
      stage++;
      return { ok: true, json: async () => ({}) };
    }
    return {
      ok: true,
      json: async () => [
        {
          ...room,
          operational_state: stage === 3 ? "ready" : "cleaning",
          housekeeping: ["start", "finish", "ready"]
            .slice(0, stage)
            .map((action) => ({
              action,
              actorId: "synthetic-staff",
              occurredAt: "2027-01-01T09:00:00Z",
            })),
        },
      ],
    };
  };
  render(createElement(StaffRooms, { token: "synthetic-token" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Start cleaning" }),
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Finish cleaning" }),
  );
  const ready = await screen.findByRole("button", { name: "Mark Ready" });
  assert.equal(ready.disabled, true);
  fireEvent.click(
    screen.getByLabelText(/I completed the applicable room checks/),
  );
  fireEvent.click(ready);
  await waitFor(() => assert.equal(posts.length, 3));
  assert.deepEqual(
    posts.map((p) => p.action),
    ["start", "finish", "ready"],
  );
  assert.equal(posts[2].checksConfirmed, true);
  assert.ok(posts.every((p) => p.checkoutId === room.checkout_id));
  assert.ok(screen.getByText(/Turnover protected until/));
  assert.equal(screen.queryByText("Available now"), null);
});
test("H01 closed gates and maintenance prevent controls; failed requests retain retry key", async () => {
  const posts = [];
  globalThis.fetch = async (_url, options) =>
    options?.method === "POST"
      ? (posts.push(JSON.parse(options.body)),
        { ok: false, json: async () => ({ error: "Conflict; refresh" }) })
      : { ok: true, json: async () => [room] };
  render(createElement(StaffRooms, { token: "synthetic-token" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Start cleaning" }),
  );
  await screen.findByText("Conflict; refresh");
  fireEvent.click(screen.getByRole("button", { name: "Start cleaning" }));
  await waitFor(() => assert.equal(posts.length, 2));
  assert.equal(posts[0].requestKey, posts[1].requestKey);
  cleanup();
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => [
      { ...room, housekeeping_enabled: false, maintenance_now: true },
    ],
  });
  render(createElement(StaffRooms, { token: "synthetic-token" }));
  const start = await screen.findByRole("button", { name: "Start cleaning" });
  assert.equal(start.disabled, true);
  assert.ok(screen.getByText(/Live housekeeping is closed/));
});
