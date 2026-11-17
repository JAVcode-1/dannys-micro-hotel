import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import App from "../src/App.tsx";

test("foundation component exposes one main landmark and heading", () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>[^<]+<\/h1>/);
  assert.doesNotMatch(html, /<button|<form/);
});
