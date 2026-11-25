import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { JSDOM } from "jsdom";

const dom = new JSDOM("", { url: "http://localhost/staff/analytics" });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup } =
  await import("@testing-library/react");
const { default: StaffAnalytics } = await import("../src/StaffAnalytics.tsx");

test("analytics displays loading, applies Manila filters, and clears a pending view on session change", async () => {
  const originalFetch = globalThis.fetch;
  const originalForm = globalThis.FormData;
  const requests = [];
  const zero = { gross: "0", refunds: "0", net: "0" };
  globalThis.FormData = dom.window.FormData;
  globalThis.fetch = (url, options) =>
    new Promise((resolve) => requests.push({ url, options, resolve }));
  const finish = (request) =>
    request.resolve({
      ok: true,
      json: async () => ({
        overall: zero,
        trends: [],
        categories: [],
        packages: [],
      }),
    });
  try {
    const { rerender } = render(
      createElement(StaffAnalytics, { token: "one", key: "one" }),
    );
    assert.ok(screen.getByRole("status"));
    finish(requests[0]);
    await screen.findByText("Completed refunds");
    assert.equal(screen.getAllByText(/No activity/).length, 3);
    fireEvent.change(screen.getByLabelText("Trend"), {
      target: { value: "week" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply filters" }));
    assert.match(requests[1].url, /grain=week/);
    rerender(createElement(StaffAnalytics, { token: "two", key: "two" }));
    assert.equal(requests[1].options.signal.aborted, true);
    assert.equal(screen.queryByText("Completed refunds"), null);
    finish(requests[1]);
    finish(requests[2]);
    await screen.findByText("Completed refunds");
    assert.equal(requests[2].options.headers.Authorization, "Bearer two");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalForm;
  }
});

test("Analytics opens the Function Hall report with its existing date filters and authorization", async () => {
  const originalFetch = globalThis.fetch;
  const originalForm = globalThis.FormData;
  const requests = [];
  const zero = { gross: "0", refunds: "0", net: "0" };
  globalThis.FormData = dom.window.FormData;
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () =>
        String(url).includes("/staff/hall/reports")
          ? {
              ...zero,
              days: [{ day: "2026-11-24", ...zero }],
              utilization: {
                bookings: 1,
                scheduled_minutes: 180,
                actual_minutes: 150,
                preparation_minutes: 30,
                cleanup_minutes: 30,
              },
            }
          : { overall: zero, trends: [], categories: [], packages: [] },
    };
  };
  try {
    render(
      createElement(StaffAnalytics, { token: "test-staff", hallEnabled: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Function Hall" }));
    assert.equal(
      requests.some(({ url }) => url.includes("/staff/hall/reports")),
      false,
    );
    fireEvent.change(screen.getByLabelText("From (Manila)"), {
      target: { value: "2026-11-24" },
    });
    fireEvent.change(screen.getByLabelText("Through (Manila)"), {
      target: { value: "2026-11-25" },
    });
    fireEvent.click(screen.getByRole("button", { name: "View report" }));
    assert.ok(
      await screen.findByRole("table", { name: "Daily Hall collections" }),
    );
    assert.match(
      screen.getByText(/actual occupied minutes/).textContent,
      /150 actual occupied minutes/,
    );
    const hall = requests.find(({ url }) =>
      url.includes("/staff/hall/reports"),
    );
    assert.match(hall.url, /from=2026-11-24&to=2026-11-25/);
    assert.equal(hall.options.headers.Authorization, "Bearer test-staff");
  } finally {
    cleanup();
    globalThis.fetch = originalFetch;
    globalThis.FormData = originalForm;
  }
});
