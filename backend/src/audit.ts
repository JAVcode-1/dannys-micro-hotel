import type { Express, RequestHandler } from "express";
import type { StaffAuditPage } from "@staytrack/shared";
import { databasePool } from "./database.js";
import { BookingError } from "./booking-quote.js";

const uuid = /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i;
const roomId = /^[1-9]\d{0,18}$/;
const actionName = /^[a-z][a-z0-9_.]{0,79}$/;
const eventId = /^[a-z_]+:[0-9a-f-]{1,36}$/;
const preciseInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function auditDate(value: string) {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
}

export function parseAuditFilters(query: Record<string, unknown>) {
  const invalid = () =>
    new BookingError("Invalid audit filters or page cursor.", 400);
  function get(key: string, max: number) {
    const value = query[key];
    if (value === undefined || value === "") return null;
    if (typeof value !== "string" || value.length > max) throw invalid();
    return value;
  }
  const actor = get("actor", 36);
  const action = get("action", 80);
  const subjectType = get("subjectType", 24);
  const subjectId = get("subjectId", 36);
  const from = get("from", 10);
  const to = get("to", 10);
  const limit = get("limit", 2) ?? "25";
  const encoded = get("cursor", 180);
  if (
    (actor && !uuid.test(actor)) ||
    (action && !actionName.test(action)) ||
    (subjectType &&
      ![
        "room",
        "room_item",
        "payment_submission",
        "hall_reservation",
        "review",
        "feedback",
      ].includes(subjectType)) ||
    (subjectId && !(subjectType === "room" ? roomId : uuid).test(subjectId)) ||
    (from && !auditDate(from)) ||
    (to && !auditDate(to)) ||
    (from && to && from > to) ||
    !/^[1-9]\d?$/.test(limit) ||
    Number(limit) > 50
  )
    throw invalid();
  let cursor: [string, string] | null = null;
  if (encoded) {
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw invalid();
      const pair: unknown = JSON.parse(
        Buffer.from(encoded, "base64url").toString("utf8"),
      );
      if (
        !Array.isArray(pair) ||
        pair.length !== 2 ||
        typeof pair[0] !== "string" ||
        !preciseInstant.test(pair[0]) ||
        !auditDate(pair[0].slice(0, 10)) ||
        !Number.isFinite(Date.parse(pair[0])) ||
        typeof pair[1] !== "string" ||
        !eventId.test(pair[1])
      )
        throw invalid();
      cursor = [pair[0], pair[1]];
    } catch {
      throw invalid();
    }
  }
  return {
    actor,
    action,
    subjectType,
    subjectId: subjectId?.toLowerCase() ?? null,
    from,
    to,
    limit: Number(limit),
    cursor,
  };
}

// Each projection exposes only known operational fields. Generic audit rows have no subject.
const sources = [
  [
    "hall_actions",
    "md5(actor::text || request_key)",
    "recorded_at",
    "'hall.' || action",
    "hall_reservation",
    "reservation_id",
    [],
  ],
  [
    "review_events",
    "id",
    "recorded_at",
    "'review.' || action",
    "review",
    "review_id",
    [],
  ],
  [
    "review_events",
    "id",
    "recorded_at",
    "'feedback.' || action",
    "feedback",
    "feedback_id",
    [],
  ],
  [
    "stay_receipts",
    "id",
    "recorded_at",
    "'stay.receipt_recorded'",
    "room_item",
    "room_booking_id",
    ["stay.stay_receipts"],
  ],
  [
    "stay_receipt_allocations",
    "id",
    "recorded_at",
    "'stay.receipt_' || kind",
    "room_item",
    "room_booking_id",
    ["stay.stay_receipt_allocations"],
  ],
  [
    "cancellation_decisions",
    "room_booking_id",
    "decided_at",
    "case when approved then 'room.cancellation_approved' else 'room.cancellation_rejected' end",
    "room_item",
    "room_booking_id",
    ["room.cancellation_approved", "room.cancellation_rejected"],
  ],
  [
    "reschedule_decisions",
    "request_id",
    "decided_at",
    "case when approved then 'room.reschedule_approved' else 'room.reschedule_rejected' end",
    "room_item",
    "room_booking_id",
    ["room.reschedule_approved", "room.reschedule_rejected"],
  ],
  [
    "refund_claims",
    "room_booking_id",
    "claimed_at",
    "'refund.original_payer_verified_and_claimed'",
    "room_item",
    "room_booking_id",
    ["refund.original_payer_verified_and_claimed"],
  ],
  [
    "refund_transfers",
    "room_booking_id",
    "recorded_at",
    "'refund.manual_transfer_recorded'",
    "room_item",
    "room_booking_id",
    ["refund.manual_transfer_recorded"],
  ],
  [
    "stay_extension_requests",
    "id",
    "recorded_at",
    "'stay.extension_requested'",
    "room_item",
    "room_booking_id",
    ["stay.stay_extension_requests"],
  ],
  [
    "stay_extension_decisions",
    "request_id",
    "recorded_at",
    "case when approved then 'stay.extension_approved' else 'stay.extension_rejected' end",
    "room_item",
    "room_booking_id",
    ["stay.stay_extension_decisions"],
  ],
  [
    "stay_charge_reviews",
    "id",
    "recorded_at",
    "'stay.' || kind || '_review'",
    "room_item",
    "room_booking_id",
    ["stay.stay_charge_reviews"],
  ],
  [
    "stay_charge_entries",
    "id",
    "recorded_at",
    "'stay.' || kind",
    "room_item",
    "room_booking_id",
    ["stay.stay_charge_entries"],
  ],
  [
    "room_check_ins",
    "room_booking_id",
    "checked_in_at",
    "'room.checked_in'",
    "room_item",
    "room_booking_id",
    ["room.checked_in"],
  ],
  [
    "room_checkouts",
    "room_booking_id",
    "checked_out_at",
    "case when balance_centavos>0 then 'room.checked_out_unpaid_exception' else 'room.checked_out' end",
    "room_item",
    "room_booking_id",
    ["room.checked_out", "room.checked_out_unpaid_exception"],
  ],
  [
    "payment_reviews",
    "id",
    "created_at",
    "'payment.review.' || decision",
    "payment_submission",
    "submission_id",
    [
      "payment.review.confirmed",
      "payment.review.rejected",
      "payment.review.mismatched",
      "payment.review.unresolved",
      "payment.review.late_reconciliation",
    ],
  ],
  [
    "housekeeping_events",
    "id",
    "occurred_at",
    "'room.housekeeping.' || action",
    "room",
    "room_id",
    [
      "room.housekeeping.start",
      "room.housekeeping.finish",
      "room.housekeeping.ready",
    ],
  ],
  [
    "maintenance_events",
    "e.id",
    "e.occurred_at",
    "'room.maintenance.' || e.action",
    "room",
    "b.room_id",
    [
      "room.maintenance.open",
      "room.maintenance.progress",
      "room.maintenance.clear",
    ],
  ],
] as const;

export async function staffAudit(
  filters: ReturnType<typeof parseAuditFilters>,
  pool = databasePool(),
): Promise<StaffAuditPage> {
  const { rows: schema } = await pool.query<{ name: string; present: boolean }>(
    "select name,to_regclass('staytrack.' || name) is not null as present from unnest($1::text[]) as names(name)",
    [sources.map(([table]) => table)],
  );
  const present = new Set(
    schema.filter((row) => row.present).map((row) => row.name),
  );
  const available = sources.filter(([table]) => present.has(table));
  const projections = available.map(
    ([table, id, time, action, subjectType, subjectId]) => `
    select '${table}:' || ${id}::text, ${table === "hall_actions" ? "actor" : "actor_auth_user_id"}, ${action}, ${time},
      '${subjectType}', ${subjectId}::text
    from staytrack.${table}${table === "maintenance_events" ? " e join staytrack.room_blocks b on b.id=e.block_id" : ""}${table === "review_events" ? ` where actor_auth_user_id is not null and ${subjectId} is not null` : ""}
  `,
  );
  const { rows } = await pool.query<StaffAuditPage["entries"][number]>(
    `
    with events(id,actor,action,occurred_at,subject_type,subject_id) as (
      select 'audit:' || id::text, actor_auth_user_id, action, occurred_at, null::text, null::text
      from staytrack.staff_audit where not (action=any($10::text[]))
      ${projections.length ? "union all " + projections.join(" union all ") : ""}
    )
    select id,actor::text as "actorId",action,
      to_char(occurred_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "occurredAt",
      subject_type as "subjectType",subject_id as "subjectId"
    from events
    where ($1::uuid is null or actor=$1)
      and ($2::text is null or action=$2)
      and ($3::text is null or subject_type=$3)
      and ($4::text is null or subject_id=$4)
      and ($5::date is null or occurred_at>=($5::date::timestamp at time zone 'Asia/Manila'))
      and ($6::date is null or occurred_at<(($6::date+1)::timestamp at time zone 'Asia/Manila'))
      and ($7::timestamptz is null or (occurred_at,id)<($7,$8::text))
    order by occurred_at desc,id desc
    limit $9
  `,
    [
      filters.actor,
      filters.action,
      filters.subjectType,
      filters.subjectId,
      filters.from,
      filters.to,
      filters.cursor?.[0] ?? null,
      filters.cursor?.[1] ?? null,
      filters.limit + 1,
      available.flatMap((source) => [...source[6]]),
    ],
  );
  const entries = rows.slice(0, filters.limit);
  const last = entries.at(-1);
  return {
    entries,
    nextCursor:
      rows.length > filters.limit && last
        ? Buffer.from(JSON.stringify([last.occurredAt, last.id])).toString(
            "base64url",
          )
        : null,
  };
}

export function registerAudit(
  app: Express,
  staff: RequestHandler,
  pool?: ReturnType<typeof databasePool>,
) {
  app.get("/staff/audit", staff, async (req, res) => {
    try {
      res.json(await staffAudit(parseAuditFilters(req.query), pool));
    } catch (error) {
      res.status(error instanceof BookingError ? error.status : 503).json({
        error:
          error instanceof BookingError
            ? error.message
            : "Staff audit is unavailable.",
      });
    }
  });
}
