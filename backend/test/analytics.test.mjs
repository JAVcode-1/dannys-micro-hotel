import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../dist/app.js";

test("analytics report and downloads require active staff and reject invalid Manila ranges", async () => {
  const app = createApp(
    async () => {},
    async (token) => (token === "staff" ? { id: "staff" } : null),
  );
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const base =
      "http://127.0.0.1:" + server.address().port + "/staff/analytics";
    for (const path of ["", "/export"]) {
      for (const [token, status] of [
        ["", 401],
        ["guest", 403],
        ["staff", 400],
      ]) {
        const response = await globalThis.fetch(
          base +
            path +
            "?from=2024-01-01&through=2025-01-01&grain=week&format=xlsx",
          { headers: token ? { Authorization: "Bearer " + token } : {} },
        );
        assert.equal(response.status, status);
        assert.match(response.headers.get("cache-control"), /no-store/);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("analytics bounds reject candidate and cumulative-row overflow without truncation", async () => {
  const { loadAnalyticsRows } = await import("../dist/analytics-data.js");
  const from = "2026-11-01T16:00:00.000000Z";
  const end = "2026-11-02T16:00:00.000000Z";
  for (const size of [10001, 50000]) {
    let count = 0;
    const client = {
      query: async (sql) => {
        if (!sql.startsWith("select * from")) return { rows: [] };
        count++;
        if (size === 10001 || count === 2)
          return { rows: Array(size).fill({}) };
        return { rows: [{ reservation_id: "fake" }] };
      },
    };
    await assert.rejects(loadAnalyticsRows(client, from, end), { status: 422 });
  }
});
