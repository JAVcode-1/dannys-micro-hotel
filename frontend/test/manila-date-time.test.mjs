import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { JSDOM } from "jsdom";
import { createElement } from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: dom.window.navigator,
});
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { render, screen, fireEvent, cleanup } =
  await import("@testing-library/react");
const { default: ManilaDateTimeInput } =
  await import("../src/ManilaDateTimeInput.tsx");
afterEach(cleanup);

test("Manila time retains PM and minutes selected before the date; noon and midnight stay distinct", () => {
  const values = [];
  render(
    createElement(ManilaDateTimeInput, {
      label: "Event",
      name: "start",
      onChange: (value) => values.push(value),
    }),
  );
  fireEvent.change(screen.getByLabelText("Event AM or PM"), {
    target: { value: "PM" },
  });
  fireEvent.change(screen.getByLabelText("Event minute"), {
    target: { value: "15" },
  });
  assert.equal(screen.getByLabelText("Event AM or PM").value, "PM");
  assert.equal(dom.window.document.querySelector('[name="start"]').value, "");
  fireEvent.change(screen.getByLabelText("Event date"), {
    target: { value: "2027-01-01" },
  });
  assert.equal(values.at(-1), "2027-01-01T12:15");
  fireEvent.change(screen.getByLabelText("Event AM or PM"), {
    target: { value: "AM" },
  });
  assert.equal(values.at(-1), "2027-01-01T00:15");
});
