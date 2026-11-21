import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import App from "../src/App.tsx";

test("guest landing exposes one main landmark, editorial heading and existing guest routes", () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>Stay on <br\/?><em>your time\.<\/em><\/h1>/);
  for (const path of ["book", "rooms", "verify"])
    assert.match(html, new RegExp(`href="/${path}"`));
  assert.match(html, /Double Standard/);
  assert.match(html, /Family Executive/);
  assert.match(html, /Function Hall/);
  assert.doesNotMatch(html, /href="\/(function-hall|reviews)"|gcash-qr/);
});
