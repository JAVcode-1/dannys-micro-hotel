/* global fetch */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { test } from "node:test";
import { URL } from "node:url";
import { fileURLToPath } from "node:url";
import { preview } from "vite";
import App from "../src/App.tsx";

test("foundation page renders with approved Royal Horizon tokens", () => {
  const html = renderToStaticMarkup(createElement(App));
  assert.match(html, /A clearer way to welcome every stay/);
  assert.match(html, /Booking and staff tools will arrive in later phases/);

  const cssFile = readdirSync(new URL("../dist/assets/", import.meta.url)).find(
    (name) => name.endsWith(".css"),
  );
  assert.ok(cssFile, "production CSS bundle exists");
  const css = readFileSync(
    new URL(`../dist/assets/${cssFile}`, import.meta.url),
    "utf8",
  );
  for (const [token, color] of Object.entries({
    "--brand-primary": "#2443b6",
    "--brand-primary-hover": "#1b3595",
    "--accent-booking": "#f97316",
    "--accent-lavender": "#eee9fa",
    "--surface-canvas": "#fafafd",
    "--surface-card": "#ffffff",
    "--text-main": "#17213d",
    "--surface-selected": "#eaf1ff",
    "--text-muted": "#475569",
    "--border-subtle": "#dde4f2",
    "--focus-ring": "#2443b6",
  })) {
    const value = css.match(new RegExp(`${token}:(#[0-9a-f]{3,6})`))?.[1];
    const expanded =
      value?.length === 4
        ? `#${[...value.slice(1)].map((digit) => digit.repeat(2)).join("")}`
        : value;
    assert.equal(expanded, color, `${token} resolves to ${color}`);
  }
});

test("Vite serves the themed foundation page and protected deep links", async () => {
  const server = await preview({
    configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    root: fileURLToPath(new URL("../", import.meta.url)),
    preview: { host: "127.0.0.1", port: 0 },
  });
  try {
    const address = server.httpServer?.address();
    assert.ok(address && typeof address !== "string");
    const origin = `http://127.0.0.1:${address.port}`;
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, /StayTrack - Danny's Micro Hotel/);
    const staffPage = await fetch(`${origin}/staff/analytics`);
    assert.equal(staffPage.status, 200);
    assert.equal(await staffPage.text(), html);
    const cssPath = html.match(/href="(\/assets\/[^"]+\.css)"/)?.[1];
    assert.ok(cssPath, "built CSS is linked from the page");
    const stylesheet = await fetch(`${origin}${cssPath}`);
    assert.equal(stylesheet.status, 200);
    assert.match(await stylesheet.text(), /--brand-primary:#2443b6/);
  } finally {
    await server.close();
  }
});
