import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HallInformation } from "../src/HallDesk.tsx";

test("hall information publishes confirmed inclusions and inquiry channels without a booking form", () => {
  const html = renderToStaticMarkup(createElement(HallInformation));
  assert.match(html, /70 people/);
  assert.match(html, /up to 50/);
  assert.match(html, /Facebook Messenger/);
  assert.match(html, /mineral water/);
  assert.doesNotMatch(html, /<form/);
});
