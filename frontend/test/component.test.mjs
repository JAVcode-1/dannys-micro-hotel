import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import App from "../src/App.tsx";
import { JSDOM } from "jsdom";

test("landing guides guests to booking while keeping verification out of the main navigation", () => {
  const document = new JSDOM(renderToStaticMarkup(createElement(App))).window
    .document;
  const navigation = document.querySelector('nav[aria-label="Main"]');
  assert.equal(navigation.querySelector('a[href="/verify"]'), null);
  assert.ok(document.querySelector('footer a[href="/verify"]'));
  assert.equal(
    navigation.querySelector('a[href="#how-to-book"]').textContent,
    "How to book",
  );
  assert.equal(
    document.querySelector('header a[href="/book"]').textContent.trim(),
    "Book a room ↗",
  );
  const guide = document.querySelector("#how-to-book");
  assert.equal(guide.querySelectorAll("ol > li").length, 5);
  assert.match(guide.textContent, /30-minute hold/);
  assert.match(guide.textContent, /screenshot of your GCash receipt/);
  assert.match(guide.textContent, /screenshot alone does not confirm/);
  assert.match(guide.textContent, /staff verifies the actual GCash payment/);
  assert.ok(guide.querySelector('a[href="/book"]'));
});

test("guest landing exposes one main landmark, editorial heading and existing guest routes", () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.equal((html.match(/<main\b/g) ?? []).length, 1);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /<h1[^>]*>Stay on <br\/?><em>your time\.<\/em><\/h1>/);
  for (const path of ["book", "verify"])
    assert.match(html, new RegExp(`href="/${path}"`));
  assert.equal(
    (html.match(/href="#rooms"[^>]*>Rooms &amp; rates/g) ?? []).length,
    2,
  );
  assert.match(html, /Double Standard/);
  assert.match(html, /href="\/rooms">View full room rates/);
  assert.equal((html.match(/href="#top" aria-label=/g) ?? []).length, 2);
  assert.match(html, /Family Executive/);
  assert.match(html, /Function Hall/);
  assert.doesNotMatch(html, /href="\/(function-hall|reviews)"|gcash-qr/);
});
