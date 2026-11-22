import { unifiedInstalled } from "./unified-booking.js";
import { cancelOnlineHall } from "./unified-hall-actions.js";
import type { HallSettings, HallQuoteInput } from "@staytrack/shared";
import type { Pool, PoolClient } from "pg";
import { createHash } from "node:crypto";
import { BookingError } from "./booking-quote.js";
import { hallDefaults, quoteHall } from "./hall-scheduling.js";
import { hallDepositMet, normalizeHallReceipt } from "./hall-payments.js";

type Input = Record<string, unknown>;
export type HallResult = {
  id?: string;
  issue?: string;
  receiptId?: string;
  previousClaim?: string | null;
  claim?: string;
  revision?: string;
  noticeReason?: string | null;
  previousStatus?: string;
  status?: string;
};
export const hallCommands = [
  "settings",
  "inquiry",
  "receipt",
  "confirm",
  "recover_inquiry",
  "reschedule",
  "extend",
  "start",
  "complete",
  "ready",
  "no_show",
  "release",
  "cancel",
  "approve_refund",
  "complete_refund",
  "overtime",
] as const;
export type HallCommand = (typeof hallCommands)[number];
type Quote = ReturnType<typeof quoteHall>;

function fail(message: string, status = 409): never {
  throw new BookingError(message, status);
}
function str(value: unknown, max = 1000) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > max ||
    value.includes("\0")
  )
    fail("Enter the required text.", 400);
  return value.trim();
}
function integer(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < min ||
    value > max
  )
    fail("Enter a valid whole number.", 400);
  return value;
}
function id(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
  )
    fail("Invalid record identifier.", 400);
  return value;
}
export function quoteInput(input: Input): HallQuoteInput {
  const setup = input.setup;
  if (setup !== "theater" && setup !== "room")
    fail("Select a hall setup.", 400);
  return {
    setup,
    attendees: integer(input.attendees, 1, 70),
    start: str(input.start, 16),
    minutes: integer(input.minutes, 180, 1440),
    noticeReason: input.noticeReason ? str(input.noticeReason) : undefined,
  };
}

export async function hallSettings(client: Pick<PoolClient, "query">) {
  const { rows } = await client.query<HallSettings>(
    `select opening,closing,notice,horizon,preparation,cleanup,no_show_grace "noShowGrace",reminder
     from staytrack.hall_settings order by id desc limit 1`,
  );
  return rows[0];
}

function settingsInput(input: Input) {
  const values = Object.keys(hallDefaults) as (keyof HallSettings)[];
  const limits = [1439, 1439, 129600, 3650, 1440, 1440, 1440, 1440];
  const parsed = values.map((key, i) => integer(input[key], 0, limits[i]));
  if (parsed[1] <= parsed[0]) fail("Closing must follow opening.", 400);
  return parsed;
}

export async function hallCommand(
  pool: Pick<Pool, "connect">,
  actor: string,
  key: string,
  action: HallCommand,
  input: Input,
) {
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(key))
    fail("A valid request key is required.", 400);
  const hash = createHash("sha256")
    .update(JSON.stringify([action, input]))
    .digest("hex");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const staff = await client.query(
      "select 1 from staytrack.staff_accounts where auth_user_id=$1 and active for share",
      [actor],
    );
    if (!staff.rowCount) fail("Staff access denied.", 403);
    const resource = await client.query<{ ready: boolean }>(
      "select ready from staytrack.hall_resource where id=1 for update",
    );
    const prior = await client.query<{
      payload_hash: string;
      result: HallResult;
    }>(
      "select payload_hash,result from staytrack.hall_actions where actor=$1 and request_key=$2",
      [actor, key],
    );
    if (prior.rows[0]) {
      if (prior.rows[0].payload_hash !== hash)
        fail("Request key already used.");
      await client.query("commit");
      return prior.rows[0].result;
    }
    const {
      rows: [clock],
    } = await client.query<{ now: Date }>("select clock_timestamp() now");
    const reservation = ["settings", "inquiry", "ready"].includes(action)
      ? null
      : id(input.id);
    const result = await applyCommand(
      client,
      actor,
      action,
      input,
      reservation,
      resource.rows[0].ready,
      +clock.now,
    );
    await client.query(
      `insert into staytrack.hall_actions(actor,request_key,payload_hash,action,reservation_id,result)
      values($1,$2,$3,$4,$5,$6)`,
      [
        actor,
        key,
        hash,
        action,
        reservation ?? (action === "inquiry" ? result.id : null),
        {
          ...result,
          ...(typeof input.reason === "string" ? { reason: input.reason } : {}),
          ...(typeof input.noticeReason === "string"
            ? { noticeReason: input.noticeReason }
            : {}),
        },
      ],
    );
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function applyCommand(
  c: PoolClient,
  actor: string,
  action: HallCommand,
  input: Input,
  reservation: string | null,
  ready: boolean,
  now: number,
): Promise<HallResult> {
  if (action === "settings") {
    const result = await c.query<{ id: string }>(
      `insert into staytrack.hall_settings(actor,opening,closing,notice,horizon,preparation,cleanup,no_show_grace,reminder)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id::text`,
      [actor, ...settingsInput(input)],
    );
    return { id: result.rows[0].id };
  }
  if (action === "ready") {
    str(input.reason);
    if (
      (
        await c.query(
          "select 1 from staytrack.hall_reservations where status='in_progress'",
        )
      ).rowCount
    )
      fail("The hall is occupied.");
    await c.query("update staytrack.hall_resource set ready=true where id=1");
    return {};
  }
  if (action === "inquiry") {
    const quote = quoteInput(input);
    quoteHall(quote, await hallSettings(c), now);
    const inserted = await c.query<{ id: string }>(
      `insert into staytrack.hall_reservations(channel,organizer,requests,quote_input)
      values($1,$2,$3,$4) returning id`,
      [
        str(input.channel, 20),
        str(input.organizer, 120),
        input.requests ? str(input.requests, 2000) : null,
        quote,
      ],
    );
    return inserted.rows[0];
  }
  const unified = await unifiedInstalled(c);
  const {
    rows: [r],
  } = await c.query<{
    id: string;
    status: string;
    quote_input: ReturnType<typeof quoteInput>;
    claim_id: string | null;
    actual_start: Date | null;
    actual_end: Date | null;
    quote: Quote | null;
    gross: string;
    refunded: string;
    approved: string;
    overtime: string;
  }>(
    `select r.*,q.quote,
    (coalesce((select sum(amount_centavos) from staytrack.hall_receipts where reservation_id=r.id),0) ${unified ? "+ coalesce((select sum(amount_centavos) from staytrack.online_payment_allocations where hall_reservation_id=r.id),0)" : ""})::text gross,
    coalesce((select sum(a.amount_centavos) from staytrack.hall_refund_approvals a
      join staytrack.hall_refund_transfers t on t.approval_id=a.id where a.reservation_id=r.id),0)::text refunded,
    coalesce((select sum(amount_centavos) from staytrack.hall_refund_approvals where reservation_id=r.id),0)::text approved,
    coalesce((select amount_centavos from staytrack.hall_overtime_charges where reservation_id=r.id),0)::text overtime
    from staytrack.hall_reservations r left join lateral
    (select quote from staytrack.hall_revisions where reservation_id=r.id order by id desc limit 1) q on true
    where r.id=$1 for update of r`,
    [reservation],
  );
  if (!r) fail("Reservation unavailable.", 404);
  const online =
    unified &&
    (
      await c.query(
        "select 1 from staytrack.online_hall_items where hall_reservation_id=$1",
        [r.id],
      )
    ).rowCount === 1;
  const net = BigInt(r.gross) - BigInt(r.refunded);
  const current = r.quote;
  const result: HallResult = {
    id: r.id,
    previousStatus: r.status,
    status: r.status,
  };
  const updateStatus = async (status: string) => {
    await c.query(
      "update staytrack.hall_reservations set status=$2 where id=$1",
      [r.id, status],
    );
    result.status = status;
  };
  const release = async () => {
    if (r.claim_id)
      await c.query(
        "update staytrack.hall_claims set released_at=clock_timestamp() where id=$1 and released_at is null",
        [r.claim_id],
      );
  };
  switch (action) {
    case "receipt": {
      const money = normalizeHallReceipt(input);
      const evidence = str(input.evidence);
      const received = transactionDate(input.receivedAt, now);
      const receipt = await c.query<{ id: string }>(
        `insert into staytrack.hall_receipts(reservation_id,actor,method,amount_centavos,normalized_reference,evidence,received_at)
        values($1,$2,$3,$4,$5,$6,$7) returning id`,
        [
          r.id,
          actor,
          money.method,
          money.amount,
          money.reference,
          evidence,
          received,
        ],
      );
      result.receiptId = receipt.rows[0].id;
      if (r.status === "cancelled" || r.status === "no_show")
        await flag(c, r.id);
      return result;
    }
    case "confirm":
    case "recover_inquiry":
    case "reschedule":
    case "extend": {
      if (online && ["confirm", "recover_inquiry"].includes(action))
        fail(
          "Confirm all online reservation items through payment verification.",
        );
      if (action !== "confirm") str(input.reason);
      if (action !== "confirm" && input.expectedClaim !== r.claim_id)
        fail("The hall schedule changed. Refresh before retrying.");
      if (
        ["confirm", "recover_inquiry"].includes(action) &&
        r.status !== "inquiry"
      )
        fail("Only an inquiry may be confirmed.");
      if (
        action === "reschedule" &&
        (r.status !== "confirmed" ||
          !current ||
          now >= Date.parse(current.start))
      )
        fail("Reschedule before the original scheduled start.");
      if (
        action === "extend" &&
        (!current ||
          !["confirmed", "in_progress"].includes(r.status) ||
          now >= Date.parse(current.end))
      )
        fail("This event cannot be extended.");
      const settings = await hallSettings(c);
      let quote: Quote;
      try {
        if (action === "extend" && current) {
          const hours = integer(input.hours, 1, 24);
          const end = Date.parse(current.end) + hours * 3600000;
          const local = new Date(end + 28800000);
          if (
            local.toISOString().slice(0, 10) !==
              new Date(Date.parse(current.start) + 28800000)
                .toISOString()
                .slice(0, 10) ||
            local.getUTCHours() * 60 + local.getUTCMinutes() >
              settings.closing ||
            (Date.parse(current.start) + 28800000) % 86400000 <
              settings.opening * 60000
          )
            fail("The extension exceeds operating hours.");
          quote = {
            ...current,
            end: new Date(end).toISOString(),
            protectedEnd: new Date(
              end + current.settings.cleanup * 60000,
            ).toISOString(),
            minutes: current.minutes + hours * 60,
            additional: current.additional + hours * 100000,
            total: current.total + hours * 100000,
          };
        } else {
          quote = quoteHall(
            action === "confirm" ? r.quote_input : quoteInput(input),
            settings,
            now,
          );
        }
      } catch (error) {
        if (!(error instanceof BookingError)) throw error;
        if (net > 0n) await flag(c, r.id);
        return { ...result, issue: error.message };
      }
      if (
        action === "extend"
          ? net < BigInt(quote.total) ||
            (r.status === "in_progress" &&
              BigInt(r.gross) - BigInt(r.approved) < BigInt(quote.total))
          : online
            ? net < BigInt(quote.total)
            : !hallDepositMet(BigInt(quote.total), net)
      ) {
        if (action !== "confirm" && net > BigInt(current?.total ?? 0))
          await flag(c, r.id);
        return {
          ...result,
          issue: "Verified payment is below the required amount.",
        };
      }
      await c.query("savepoint hall_claim");
      try {
        await release();
        const {
          rows: [claim],
        } = await c.query<{ id: string }>(
          `insert into staytrack.hall_claims(setup,attendees,event_start,event_end,preparation_start,cleanup_end)
          values($1,$2,$3,$4,$5,$6) returning id`,
          [
            quote.setup,
            quote.attendees,
            quote.start,
            quote.end,
            quote.protectedStart,
            quote.protectedEnd,
          ],
        );
        const revision = await c.query<{ id: string }>(
          `insert into staytrack.hall_revisions(reservation_id,claim_id,total_centavos,quote)
          values($1,$2,$3,$4) returning id::text`,
          [r.id, claim.id, quote.total, quote],
        );
        result.previousClaim = r.claim_id;
        result.claim = claim.id;
        result.revision = revision.rows[0].id;
        result.noticeReason = quote.noticeReason;
        result.status = action === "extend" ? r.status : "confirmed";
        await c.query(
          `update staytrack.hall_reservations set claim_id=$2,status=$3,payment_resolution=$4 where id=$1`,
          [
            r.id,
            claim.id,
            action === "extend" ? r.status : "confirmed",
            net > BigInt(quote.total),
          ],
        );
        if (action === "recover_inquiry")
          await c.query(
            "update staytrack.hall_reservations set quote_input=$2 where id=$1",
            [r.id, quoteInput(input)],
          );
      } catch (error) {
        if ((error as { code?: string }).code !== "23P01") throw error;
        await c.query("rollback to savepoint hall_claim");
        if (net > 0n) await flag(c, r.id);
        return { ...result, issue: "The protected interval is unavailable." };
      }
      return result;
    }
    case "start":
      if (
        r.status !== "confirmed" ||
        !current ||
        now < Date.parse(current.start) ||
        now >= Date.parse(current.end)
      )
        fail("Start a confirmed event during its scheduled interval.");
      if (net < BigInt(current.total))
        fail("Full verified net payment is required.");
      if (BigInt(r.gross) - BigInt(r.approved) < BigInt(current.total))
        fail("Resolve the outstanding refund approval before starting.");
      if (
        !ready ||
        (
          await c.query(
            "select 1 from staytrack.hall_reservations where status='in_progress'",
          )
        ).rowCount
      )
        fail("The hall must be vacant, clean and ready.");
      await c.query(
        "update staytrack.hall_reservations set status='in_progress',actual_start=clock_timestamp() where id=$1",
        [r.id],
      );
      await c.query(
        "update staytrack.hall_resource set ready=false where id=1",
      );
      result.status = "in_progress";
      return result;
    case "complete":
      if (r.status !== "in_progress")
        fail("Only an event in progress may be completed.");
      await c.query(
        "update staytrack.hall_reservations set status='completed',actual_end=clock_timestamp() where id=$1",
        [r.id],
      );
      result.status = "completed";
      return result;
    case "no_show":
      str(input.reason);
      if (
        r.status !== "confirmed" ||
        !current ||
        now <
          Date.parse(current.start) +
            (await hallSettings(c)).noShowGrace * 60000
      )
        fail(
          "The no-show grace period has not elapsed or the event is ineligible.",
        );
      await updateStatus("no_show");
      return result;
    case "release":
      str(input.reason);
      if (r.status !== "no_show" || !ready)
        fail("Only a no-show claim in a ready hall may be released early.");
      await release();
      return result;
    case "cancel":
      str(input.reason);
      if (online) {
        await cancelOnlineHall(c, r.id, now);
        result.status = "cancelled";
        return result;
      }
      if (!["inquiry", "confirmed"].includes(r.status))
        fail("This reservation cannot be cancelled.");
      await release();
      await updateStatus("cancelled");
      if (net > 0n) await flag(c, r.id);
      return result;
    case "approve_refund": {
      const reason = str(input.reason);
      const amount = integer(input.amount, 0);
      if (
        online &&
        (!current ||
          !["confirmed", "in_progress", "completed"].includes(r.status) ||
          amount <= 0 ||
          BigInt(amount) >
            BigInt(r.gross) - BigInt(current.total) - BigInt(r.approved))
      )
        fail(
          "Approve only the verified Hall overpayment left after its full current cost and all prior refund approvals. Eligible cancellation creates its own refund approval.",
        );
      if (
        r.status === "in_progress" &&
        current &&
        BigInt(r.gross) - BigInt(r.approved) - BigInt(amount) <
          BigInt(current.total)
      )
        fail("A refund cannot underfund an event in progress.");
      if (BigInt(r.approved) + BigInt(amount) > BigInt(r.gross))
        fail("Refund exceeds verified collections.");
      const {
        rows: [approval],
      } = await c.query<{ id: string }>(
        `insert into staytrack.hall_refund_approvals(reservation_id,amount_centavos,reason)
        values($1,$2,$3) returning id`,
        [r.id, amount, reason],
      );
      return approval;
    }
    case "complete_refund": {
      const approval = id(input.approval);
      const eligible = await c.query(
        `select 1 from staytrack.hall_refund_approvals a where a.id=$1 and a.reservation_id=$2 and a.amount_centavos>0
        and not exists(select 1 from staytrack.hall_refund_transfers t where t.approval_id=a.id)`,
        [approval, r.id],
      );
      if (!eligible.rowCount || input.verified !== true)
        fail("Record only a verified, approved refund.");
      if (online && input.method !== "gcash")
        fail("Online refunds require a verified manual GCash transfer.");
      const money = normalizeHallReceipt({ ...input, amount: 1 });
      const transferred = transactionDate(input.transferredAt, now);
      await c.query(
        `insert into staytrack.hall_refund_transfers(approval_id,method,reference,transferred_at,evidence)
        values($1,$2,$3,$4,$5)`,
        [
          approval,
          money.method,
          money.reference,
          transferred,
          str(input.evidence),
        ],
      );
      await flag(c, r.id);
      return result;
    }
    case "overtime":
      if (
        r.status !== "completed" ||
        !r.actual_end ||
        !current ||
        +r.actual_end <= Date.parse(current.end) ||
        BigInt(r.overtime) > 0n
      )
        fail("No completed unapproved overrun is available for review.");
      await c.query(
        "insert into staytrack.hall_overtime_charges values($1,$2,$3)",
        [r.id, integer(input.amount, 1), str(input.reason)],
      );
      return result;
  }
}

function transactionDate(value: unknown, now: number) {
  const date = str(value, 40);
  const instant = Date.parse(date);
  if (
    !/(Z|[+-]\d\d:\d\d)$/.test(date) ||
    !Number.isFinite(instant) ||
    instant > now
  )
    fail("Enter a valid transaction time at or before now.", 400);
  return new Date(instant).toISOString();
}

async function flag(c: PoolClient, reservation: string) {
  await c.query(
    "update staytrack.hall_reservations set payment_resolution=true where id=$1",
    [reservation],
  );
}
