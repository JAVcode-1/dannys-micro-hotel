import assert from "node:assert/strict";
import { loadAnalyticsRows } from "../dist/analytics-data.js";
import { calculateAnalytics } from "../dist/analytics-report.js";

export async function h03AnalyticsPostgres(t, pool) {
  await t.test(
    "H03-B registry-backed snapshot reconciles with authoritative cash events",
    async () => {
      const from = "2025-12-31T16:00:00.000000Z";
      const end = "2027-01-01T16:00:00.000000Z";
      const client = await pool.connect();
      try {
        await client.query("begin isolation level repeatable read read only");
        const start = Date.now();
        const rows = await loadAnalyticsRows(client, from, end);
        t.diagnostic(
          "Bounded analytics snapshot read in " +
            Math.round(Date.now() - start) +
            " ms",
        );
        assert.ok(rows.registry.size > 0);
        assert.equal(
          new Set(rows.payments.map((entry) => entry.id)).size,
          rows.payments.length,
        );
        const expected = (
          await client.query(
            `
        select sum(amount)::text total from (
          select amount_centavos as amount from staytrack.verified_online_payments where received_at >= $1 and received_at < $2
          union all select amount_centavos from staytrack.walkin_ledger where kind='payment'
            and coalesce(received_at,recorded_at) >= $1 and coalesce(received_at,recorded_at) < $2
          union all select amount_centavos from staytrack.stay_receipts where received_at >= $1 and received_at < $2
        ) events
      `,
            [from, end],
          )
        ).rows[0].total;
        assert.equal(
          calculateAnalytics(rows, from, end, "month").overall.gross,
          expected,
        );
        assert.equal(
          (await client.query("show transaction_read_only")).rows[0]
            .transaction_read_only,
          "on",
        );
      } finally {
        await client.query("rollback");
        client.release();
      }
    },
  );
}
