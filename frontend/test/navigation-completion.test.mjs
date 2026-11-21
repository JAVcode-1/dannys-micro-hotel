import assert from "node:assert/strict";
import { test, afterEach } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
/* global window */
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173/missing",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, cleanup } = await import("@testing-library/react");
const { default: App } = await import("../src/App.tsx");
afterEach(cleanup);
test("unknown pages and disabled public modules give explicit states", () => {
  for (const [path, label] of [
    ["/missing", "Page not found"],
    ["/payment-preview", "Page not found"],
    ["/reviews", "Reviews are unavailable"],
    ["/function-hall", "Function Hall is unavailable"],
  ]) {
    window.history.replaceState(null, "", path);
    render(createElement(App));
    assert.ok(screen.getByText(new RegExp(label)));
    cleanup();
  }
});
