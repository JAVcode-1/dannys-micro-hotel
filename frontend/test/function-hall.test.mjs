import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HallInformation } from "../src/HallDesk.tsx";

test("hall information publishes rates and setup-specific unified booking entry points", () => {
  const html = renderToStaticMarkup(createElement(HallInformation));
  assert.match(html, /70 attendees/);
  assert.match(html, /up to 50/);
  assert.match(html, /₱3,000\.00/);
  assert.match(html, /₱5,000\.00/);
  assert.match(html, /₱1,000\.00/);
  assert.match(html, /\/book\?service=hall&amp;setup=theater/);
  assert.match(html, /\/book\?service=hall&amp;setup=room/);
  assert.match(html, /one full GCash payment/);
  assert.match(html, /Staff verify the actual transaction/);
  assert.match(html, /mineral water/);
  assert.match(html, /Function Hall status/);
  assert.match(html, /Availability depends on your event date and time/);
  assert.doesNotMatch(html, /<form/);
});
