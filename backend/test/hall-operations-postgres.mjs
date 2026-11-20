import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { hallCommand } from "../dist/hall-reservations.js";
import { hallReport } from "../dist/hall-reports.js";
import { loadAnalyticsRows } from "../dist/analytics-data.js";
import { calculateAnalytics } from "../dist/analytics-report.js";

export async function hallOperationsPostgres(t, pool) {
  await t.test(
    "hall funding survives schedule loss, refunds serialize, and reports stay separate",
    async () => {
      for (const file of [
        "20261120001800_function_hall_payments.sql",
        "20261120001900_function_hall_operations.sql",
      ])
        await pool.query(
          readFileSync(
            new URL("../../supabase/migrations/" + file, import.meta.url),
            "utf8",
          ),
        );
      const {
        rows: [staff],
      } = await pool.query(
        "select auth_user_id id from staytrack.staff_accounts where active limit 1",
      );
      let sequence = 0;
      const command = (
        action,
        input,
        key = "hall-test-key-" + String(++sequence).padStart(5, "0"),
      ) => hallCommand(pool, staff.id, key, action, input);
      const {
        rows: [date],
      } =
        await pool.query(`select to_char((clock_timestamp() at time zone 'Asia/Manila')::date+2,'YYYY-MM-DD') as event_day,
      to_char(clock_timestamp() at time zone 'Asia/Manila','YYYY-MM-DD') today`);
      const schedule = {
        start: date.event_day + "T14:00",
        minutes: 180,
        setup: "theater",
        attendees: 35,
        organizer: "Synthetic hall organizer",
        channel: "walk_in",
      };
      const accommodationBefore = await accommodationSnapshot(pool);
      const a = (await command("inquiry", schedule)).id;
      const b = (
        await command("inquiry", {
          ...schedule,
          channel: "telephone",
          setup: "room",
        })
      ).id;
      const receipt = (id, amount, extra = {}) => ({
        id,
        amount,
        method: "cash",
        verified: true,
        evidence: "Synthetic verified cash",
        receivedAt: new Date(Date.now() - 1000).toISOString(),
        ...extra,
      });
      const historic = (
        await pool.query(
          "select normalized_reference from staytrack.gcash_reference_registry limit 1",
        )
      ).rows[0];
      assert.ok(historic);
      await assert.rejects(
        command(
          "receipt",
          receipt(a, 1, {
            method: "gcash",
            reference: historic.normalized_reference,
          }),
        ),
        { code: "23505" },
      );
      const duplicate = { method: "gcash", reference: "Hall-Synthetic-001" };
      const gcash = await Promise.allSettled([
        command("receipt", receipt(a, 1000, duplicate)),
        command("receipt", receipt(b, 1000, duplicate)),
      ]);
      assert.equal(gcash.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(
        gcash.find((r) => r.status === "rejected").reason.code,
        "23505",
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from staytrack.gcash_reference_registry where normalized_reference='HALLSYNTHETIC001' and hall_receipt_id is not null",
          )
        ).rows[0].n,
        1,
      );
      await command("receipt", receipt(a, 150000));
      await command("receipt", receipt(b, 150000));
      const confirmed = await Promise.all([
        command("confirm", { id: a }),
        command("confirm", { id: b }),
      ]);
      assert.equal(confirmed.filter((r) => !r.issue).length, 1);
      const winner = confirmed.find((r) => !r.issue).id;
      const loser = confirmed.find((r) => r.issue).id;
      const {
        rows: [lost],
      } = await pool.query(
        "select claim_id,payment_resolution from staytrack.hall_reservations where id=$1",
        [loser],
      );
      assert.deepEqual(lost, { claim_id: null, payment_resolution: true });
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from staytrack.hall_receipts",
          )
        ).rows[0].n,
        3,
      );
      const other = (
        await command("inquiry", {
          ...schedule,
          start: date.event_day + "T18:00",
          channel: "messenger",
        })
      ).id;
      await command("receipt", receipt(other, 250000));
      assert.equal((await command("confirm", { id: other })).issue, undefined);
      await command("receipt", receipt(winner, 250000));
      const original = (
        await pool.query(
          "select claim_id from staytrack.hall_reservations where id=$1",
          [winner],
        )
      ).rows[0].claim_id;
      assert.match(
        (
          await command("extend", {
            id: winner,
            expectedClaim: original,
            hours: 1,
            reason: "Synthetic extension",
          })
        ).issue,
        /unavailable/,
      );
      assert.match(
        (
          await command("reschedule", {
            ...schedule,
            id: winner,
            expectedClaim: original,
            start: date.event_day + "T18:00",
            reason: "Synthetic move",
          })
        ).issue,
        /unavailable/,
      );
      assert.equal(
        (
          await pool.query(
            "select claim_id from staytrack.hall_reservations where id=$1",
            [winner],
          )
        ).rows[0].claim_id,
        original,
      );
      await command("cancel", { id: loser, reason: "Synthetic cancellation" });
      const refunds = await Promise.allSettled(
        [1, 2].map(() =>
          command("approve_refund", {
            id: loser,
            amount: 100000,
            reason: "Synthetic refund",
          }),
        ),
      );
      assert.equal(refunds.filter((r) => r.status === "fulfilled").length, 1);
      const approval = refunds.find((r) => r.status === "fulfilled").value.id;
      await command("complete_refund", {
        id: loser,
        approval,
        method: "cash",
        verified: true,
        evidence: "Synthetic return",
        transferredAt: new Date(Date.now() - 1000).toISOString(),
      });
      const report = await hallReport(pool, date.today, date.today);
      assert.deepEqual(
        [report.gross, report.refunds, report.net],
        ["801000", "100000", "701000"],
      );
      const accommodation = await pool.query(
        "select id from staytrack.reservations where channel='walk_in' limit 1",
      );
      await assert.rejects(
        pool.query(
          `
        insert into staytrack.walkin_ledger(reservation_id,kind,method,amount_centavos,transaction_reference,normalized_reference,
          recipient,received_at,ledger_checked,receiving_account_checked,time_checked,actor_auth_user_id,request_key,request_hash)
        values($1,'payment','gcash',1000,'HALLSYNTHETIC001','HALLSYNTHETIC001','Synthetic account',
          clock_timestamp(),true,true,true,$2,'hall-reverse-reference',repeat('0',64))`,
          [accommodation.rows[0].id, staff.id],
        ),
        { code: "23505" },
      );
      await assert.rejects(
        command("extend", {
          id: winner,
          expectedClaim: original.slice(0, -1),
          hours: 1,
          reason: "Stale form",
        }),
        { status: 409 },
      );
      await pool.query(
        `insert into staytrack.hall_revisions(reservation_id,claim_id,total_centavos,quote)
        select reservation_id,claim_id,total_centavos,
        jsonb_set(jsonb_set(quote,'{start}',to_jsonb(to_char(clock_timestamp() at time zone 'UTC' - interval '5 minutes','YYYY-MM-DD"T"HH24:MI:SS"Z"'))),
          '{end}',to_jsonb(to_char(clock_timestamp() at time zone 'UTC' + interval '3 hours','YYYY-MM-DD"T"HH24:MI:SS"Z"')))
        from staytrack.hall_revisions where reservation_id=$1 order by id desc limit 1`,
        [winner],
      );
      await assert.rejects(command("start", { id: winner }), /ready/);
      await command("ready", { reason: "Synthetic cleanup verified" });
      const racing = await Promise.allSettled([
        command("start", { id: winner }),
        command("approve_refund", {
          id: winner,
          amount: 150000,
          reason: "Synthetic concurrent refund",
        }),
      ]);
      assert.equal(racing.filter((r) => r.status === "fulfilled").length, 1);
      if (racing[0].status === "fulfilled") {
        await command("complete", { id: winner });
        await assert.rejects(command("start", { id: winner }), { status: 409 });
      } else {
        await command("complete_refund", {
          id: winner,
          approval: racing[1].value.id,
          method: "cash",
          verified: true,
          evidence: "Synthetic transfer",
          transferredAt: new Date(Date.now() - 1000).toISOString(),
        });
        await assert.rejects(command("start", { id: winner }), /Full verified/);
      }
      assert.deepEqual(await accommodationSnapshot(pool), accommodationBefore);
    },
  );
}

async function accommodationSnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query("begin isolation level repeatable read read only");
    const from = "2025-12-31T16:00:00.000000Z";
    const end = "2027-01-01T16:00:00.000000Z";
    const report = calculateAnalytics(
      await loadAnalyticsRows(client, from, end),
      from,
      end,
      "month",
    );
    const claims = await client.query(
      "select count(*)::int n from staytrack.inventory_claims",
    );
    return { money: report.overall, claims: claims.rows[0].n };
  } finally {
    await client.query("rollback");
    client.release();
  }
}
