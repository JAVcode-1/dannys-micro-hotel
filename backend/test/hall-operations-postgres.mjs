import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { hallCommand } from "../dist/hall-reservations.js";
import { readPublicHallStatus } from "../dist/hall-routes.js";
import { readHallStatus } from "../dist/hall-status.js";
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
      const cash = await command("receipt", {
        id: a,
        amount: 150000,
        method: "cash",
        verified: true,
      });
      const {
        rows: [cashReceipt],
      } = await pool.query(
        "select received_at<=clock_timestamp() as received, evidence, normalized_reference from staytrack.hall_receipts where id=$1",
        [cash.receiptId],
      );
      assert.deepEqual(cashReceipt, {
        received: true,
        evidence: "Staff confirmed cash received.",
        normalized_reference: null,
      });
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
      const recovery = await command("recover_inquiry", {
        ...schedule,
        id: loser,
        expectedClaim: null,
        start: date.event_day + "T08:00",
        reason: "Guest agreed to an alternative schedule",
      });
      assert.equal(recovery.issue, undefined);
      assert.equal(recovery.status, "confirmed");
      assert.equal(
        (
          await pool.query(
            "select quote_input->>'start' start from staytrack.hall_reservations where id=$1",
            [loser],
          )
        ).rows[0].start,
        date.event_day + "T08:00",
      );
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
      const replayPayload = receipt(other, 100, {
        evidence: "Synthetic retry receipt",
      });
      const replayKey = "hall-durable-retry-0001";
      const replayFirst = await command("receipt", replayPayload, replayKey);
      assert.deepEqual(
        await command("receipt", replayPayload, replayKey),
        replayFirst,
      );
      assert.equal(
        (
          await pool.query(
            "select count(*)::int n from staytrack.hall_receipts where id=$1",
            [replayFirst.receiptId],
          )
        ).rows[0].n,
        1,
      );
      await assert.rejects(
        command("receipt", { ...replayPayload, amount: 101 }, replayKey),
        /Request key already used/,
      );
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
        amount: 100000,
        method: "cash",
        verified: true,
        evidence: "Synthetic return",
        transferredAt: new Date(Date.now() - 1000).toISOString(),
      });
      const report = await hallReport(pool, date.today, date.today);
      assert.deepEqual(
        [report.gross, report.refunds, report.net],
        ["801100", "100000", "701100"],
      );
      const bufferOnly = await pool.query(
        `insert into staytrack.hall_claims(setup,attendees,event_start,event_end,preparation_start,cleanup_end)
        select 'theater',10,(($1::date+1)::timestamp at time zone 'Asia/Manila') + interval '30 minutes',
        (($1::date+1)::timestamp at time zone 'Asia/Manila') + interval '210 minutes',
        (($1::date+1)::timestamp at time zone 'Asia/Manila') - interval '30 minutes',
        (($1::date+1)::timestamp at time zone 'Asia/Manila') + interval '240 minutes' returning id`,
        [date.today],
      );
      await pool.query(
        `insert into staytrack.hall_reservations(channel,organizer,quote_input,claim_id,status)
        values('walk_in','Synthetic buffer boundary','{}',$1,'confirmed')`,
        [bufferOnly.rows[0].id],
      );
      const bufferReport = await hallReport(pool, date.today, date.today);
      assert.equal(bufferReport.utilization.bookings, 0);
      assert.equal(bufferReport.utilization.scheduled_minutes, 0);
      assert.equal(bufferReport.utilization.preparation_minutes, 30);
      assert.equal(bufferReport.utilization.cleanup_minutes, 0);
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
          amount: 150000,
          method: "cash",
          verified: true,
          evidence: "Synthetic transfer",
          transferredAt: new Date(Date.now() - 1000).toISOString(),
        });
        await assert.rejects(
          command("start", { id: winner }),
          /Full verified|at least half/,
        );
      }
      const direct = {
        ...schedule,
        start: date.event_day + "T23:00",
        method: "cash",
        amount: 250000,
        verified: true,
      };
      await assert.rejects(
        command("book_walk_in", { ...direct, amount: 249999 }),
        /at least half/,
      );
      const directKey = "hall-direct-walk-in-001";
      const competing = await Promise.all([
        command("book_walk_in", direct, directKey),
        command("book_walk_in", direct),
      ]);
      assert.equal(
        competing.filter((result) => result.status === "confirmed").length,
        1,
      );
      const collision = competing.find((result) => result.issue);
      assert.match(collision.issue, /unavailable/);
      assert.equal(collision.status, "inquiry");
      assert.equal(collision.claim, undefined);
      assert.ok(collision.receiptId);
      assert.deepEqual(
        await command("book_walk_in", direct, directKey),
        competing[0],
      );
      const recorded = await pool.query(
        `select r.channel,r.payment_resolution,count(p.id)::int as receipts
         from staytrack.hall_reservations r
         join staytrack.hall_receipts p on p.reservation_id=r.id
         where r.id=$1 or r.id=$2 group by r.id order by r.payment_resolution`,
        competing.map((result) => result.id),
      );
      assert.deepEqual(recorded.rows, [
        { channel: "walk_in", payment_resolution: false, receipts: 1 },
        { channel: "walk_in", payment_resolution: true, receipts: 1 },
      ]);
      const directWinner = competing.find(
        (result) => result.status === "confirmed",
      );
      await assert.rejects(
        command("start", { id: directWinner.id }),
        /scheduled interval/,
      );
      await pool.query(
        `insert into staytrack.hall_revisions(reservation_id,claim_id,total_centavos,quote)
         select reservation_id,claim_id,total_centavos,
           quote || jsonb_build_object('start',now() - interval '5 minutes','end',now() + interval '3 hours')
         from staytrack.hall_revisions where reservation_id=$1 order by id desc limit 1`,
        [directWinner.id],
      );
      await command("ready", { reason: "Synthetic cleanup verified" });
      assert.equal(
        (await command("start", { id: directWinner.id })).status,
        "in_progress",
      );
      await command("complete", { id: directWinner.id });
      const statusDb = await pool.connect();
      try {
        await statusDb.query("begin");
        await statusDb.query(
          "update staytrack.hall_resource set ready=true where id=1",
        );
        assert.deepEqual(await readPublicHallStatus(statusDb), {
          status: "available",
        });
        await statusDb.query(
          "update staytrack.hall_resource set ready=false where id=1",
        );
        assert.deepEqual(await readPublicHallStatus(statusDb), {
          status: "not_ready",
        });
        await statusDb.query(
          "update staytrack.hall_claims set released_at=clock_timestamp() where released_at is null",
        );
        const {
          rows: [currentClaim],
        } = await statusDb.query(
          `insert into staytrack.hall_claims(setup,attendees,event_start,event_end,preparation_start,cleanup_end)
           values ('room', 20, now() + interval '5 minutes', now() + interval '185 minutes',
                   now() - interval '1 minute', now() + interval '215 minutes') returning id, cleanup_end`,
        );
        assert.deepEqual(await readPublicHallStatus(statusDb), {
          status: "reserved",
        });
        await statusDb.query(
          "update staytrack.hall_resource set ready=true where id=1",
        );
        const readyAndHeld = await readHallStatus(statusDb);
        assert.equal(readyAndHeld.ready, true);
        assert.equal(readyAndHeld.reserved, true);
        assert.deepEqual(readyAndHeld.reservedUntil, currentClaim.cleanup_end);
        await statusDb.query(
          "update staytrack.hall_resource set ready=false where id=1",
        );
        await statusDb.query(
          "update staytrack.hall_claims set released_at=clock_timestamp() where id=$1",
          [currentClaim.id],
        );
        assert.equal((await readHallStatus(statusDb)).reservedUntil, null);
        assert.deepEqual(await readPublicHallStatus(statusDb), {
          status: "not_ready",
        });
        await statusDb.query(
          "update staytrack.hall_reservations set status='in_progress',actual_start=clock_timestamp(),actual_end=null where id=$1",
          [winner],
        );
        assert.deepEqual(await readPublicHallStatus(statusDb), {
          status: "in_use",
        });
      } finally {
        await statusDb.query("rollback");
        statusDb.release();
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
