/* global fetch */
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
import { URL } from "node:url";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost/staff/audit",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup } =
  await import("@testing-library/react");
const { default: StaffAuditDesk } = await import("../src/StaffAuditDesk.tsx");

test("H03 staff audit sends filters and cursor and displays missing historical subjects", async () => {
  const originalFetch = fetch;
  const originalForm = globalThis.FormData;
  const requests = [];
  globalThis.FormData = dom.window.FormData;
  globalThis.fetch = async (url, options) => {
    const query = new URL(String(url), "http://localhost").searchParams;
    requests.push(query);
    assert.equal(options.headers.Authorization, "Bearer synthetic-staff");
    return {
      ok: true,
      json: async () => ({
        entries: [
          {
            id: "audit:1",
            action: query.get("cursor") ? "fixture.next" : "fixture.open",
            occurredAt: "2026-11-20T00:02:03.000001Z",
            actorId: "synthetic-staff",
            subjectType: null,
            subjectId: null,
          },
        ],
        nextCursor: query.get("cursor") ? null : "next-cursor",
      }),
    };
  };
  try {
    render(createElement(StaffAuditDesk, { token: "synthetic-staff" }));
    assert.ok(await screen.findByText("No subject recorded"));
    fireEvent.change(screen.getByLabelText("Action"), {
      target: { value: "fixture.open" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search audit" }));
    await screen.findByText("fixture.open");
    assert.equal(requests.at(-1).get("action"), "fixture.open");
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await screen.findByText("fixture.next");
    assert.equal(requests.at(-1).get("action"), "fixture.open");
    assert.equal(requests.at(-1).get("cursor"), "next-cursor");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalForm;
  }
});
