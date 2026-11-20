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
