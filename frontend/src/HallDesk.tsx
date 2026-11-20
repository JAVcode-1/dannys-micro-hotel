import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiBase } from "./staff-auth";

const pesos = (c: string | number) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(
    Number(c) / 100,
  );
const hotel = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});
type Row = {
  claim_id: string | null;
  preparation_conflict: boolean;
  id: string;
  organizer: string;
  channel: string;
  status: string;
  ready: boolean;
  payment_resolution: boolean;
  total: string;
  overtime: string;
  collected: string;
  refunded: string;
  balance: string;
  actual_end: string | null;
  requests: string | null;
  quote_input: { start: string };
  quote: { start: string; end: string } | null;
};
type Report = {
  gross: string;
  refunds: string;
  net: string;
  days: { day: string; gross: string; refunds: string; net: string }[];
  utilization: {
    actual_minutes: number;
    bookings: number;
    scheduled_minutes: number;
    preparation_minutes: number;
    cleanup_minutes: number;
  };
};

export function HallInformation() {
  return (
    <main className="min-h-svh bg-canvas px-6 py-14 text-main">
      <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-subtle bg-white p-8">
        <h1 className="text-3xl font-semibold">Function Hall</h1>
        <p>
          Theater Type accommodates up to 70 people. Room Type accommodates up
          to 50.
        </p>
        <p>
          Three hours cost ₱3,000 for starts from 8:00 AM to before 5:00 PM, or
          ₱5,000 for starts at 5:00 PM onward. Additional full hours cost
          ₱1,000. Staff confirm available event times.
        </p>
        <p>Air-conditioning, sound system and mineral water are included.</p>
        <p>
          Ask the hotel in person, by telephone, or through Facebook Messenger.
          Staff confirm reservations after verifying the down payment and
          availability.
        </p>
      </section>
    </main>
  );
}

const field = "block w-full rounded border border-subtle bg-white p-2";
const button =
  "min-h-11 rounded bg-primary px-4 text-white disabled:opacity-50";
function Text({
  name,
  label,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      {label}
      <input className={field} name={name} type={type} required={required} />
    </label>
  );
}
function Schedule() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label>
        Setup
        <select name="setup" className={field}>
          <option value="theater">Theater Type</option>
          <option value="room">Room Type</option>
        </select>
      </label>
      <Text name="attendees" label="Attendees" type="number" />
      <Text name="start" label="Manila event start" type="datetime-local" />
      <Text name="minutes" label="Booked minutes" type="number" />
      <Text
        name="noticeReason"
        label="Minimum notice override reason"
        required={false}
      />
    </div>
  );
}
const settingsLabels: Record<string, string> = {
  opening: "Opening (minutes after midnight)",
  closing: "Closing (minutes after midnight)",
  notice: "Minimum notice (minutes)",
  horizon: "Booking horizon (calendar days)",
  preparation: "Preparation (minutes)",
  cleanup: "Cleanup (minutes)",
  noShowGrace: "No-show grace (minutes)",
  reminder: "Countdown reminder (minutes before end)",
};

export default function HallDesk({ token }: { token: string }) {
  const [entries, setEntries] = useState<Row[]>([]);
  const [settings, setSettings] = useState<Record<string, number>>();
  const [report, setReport] = useState<Report>();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now);
  const [action, setAction] = useState("receipt");
  const [tab, setTab] = useState("calendar");
  const [retry, setRetry] = useState<{ payload: string; key: string }>();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const headers = { Authorization: "Bearer " + token };
    void Promise.all(
      ["reservations?page=" + page, "settings"].map(async (path) => {
        const response = await fetch(apiBase + "/staff/hall/" + path, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Function Hall is unavailable.");
        return response.json();
      }),
    )
      .then(([calendar, config]) => {
        if (!controller.signal.aborted) {
          setEntries(calendar.entries);
          setSettings(config);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage("Function Hall is unavailable.");
      });
    return () => controller.abort();
  }, [token, revision, page]);
  async function send(event: FormEvent<HTMLFormElement>, path: string) {
    event.preventDefault();
    if (busy) return;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const data: Record<string, unknown> = { ...values };
    if (path === "actions/reschedule" || path === "actions/extend")
      data.expectedClaim = entries.find(
        (entry) => entry.id === data.id,
      )?.claim_id;
    for (const key of [
      "attendees",
      "minutes",
      "amount",
      "hours",
      ...Object.keys(settingsLabels),
    ])
      if (key in data) data[key] = Number(data[key]);
    if (typeof data.receivedAt === "string") data.receivedAt += ":00+08:00";
    if (typeof data.transferredAt === "string")
      data.transferredAt += ":00+08:00";
    if (data.verified === "on") data.verified = true;
    setBusy(true);
    setMessage("");
    try {
      const headers = {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json",
      };
      const payload = JSON.stringify(data);
      const fingerprint = path + payload;
      const key =
        retry?.payload === fingerprint
          ? retry.key
          : globalThis.crypto.randomUUID();
      setRetry({ payload: fingerprint, key });
      const response = await fetch(
        apiBase +
          "/staff/hall/" +
          (path === "reports"
            ? "reports?" + new URLSearchParams(values as Record<string, string>)
            : path),
        path === "reports"
          ? { headers }
          : {
              method: "POST",
              headers: { ...headers, "Idempotency-Key": key },
              body: payload,
            },
      );
      const result = await response.json();
      if (!response.ok) {
        if (response.status < 500) setRetry(undefined);
        if (result.issue) setRevision((v) => v + 1);
        throw new Error(result.error ?? result.issue ?? "Action unavailable.");
      }
      setRetry(undefined);
      if (path === "reports") setReport(result);
      else if (path === "quote")
        setMessage(
          pesos(result.total) +
            (result.available
              ? " · Available when checked"
              : " · Protected interval unavailable"),
        );
      else {
        setMessage(
          result.id
            ? "Action recorded. Reference: " + result.id
            : "Action recorded.",
        );
        setRevision((v) => v + 1);
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Action unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 space-y-5">
      <h2 className="text-2xl font-semibold">Function Hall</h2>
      <nav
        aria-label="Function Hall"
        className="flex flex-wrap gap-4 text-primary"
      >
        {[
          ["calendar", "Calendar"],
          ["new", "New inquiry"],
          ["settings", "Settings"],
          ["reports", "Reports"],
        ].map(([key, label]) => (
          <button
            key={key}
            aria-pressed={tab === key}
            onClick={() => {
              setTab(key);
              setMessage("");
            }}
            className="min-h-11"
          >
            {label}
          </button>
        ))}
      </nav>
      {message && (
        <p role="status" className="break-words rounded bg-canvas p-3">
          {message}
        </p>
      )}
      {tab === "new" && (
        <>
          <form
            className="space-y-3"
            onSubmit={(event) => void send(event, "actions/inquiry")}
          >
            <label>
              Channel
              <select name="channel" className={field}>
                <option value="walk_in">Walk-in</option>
                <option value="telephone">Telephone</option>
                <option value="messenger">Facebook Messenger</option>
              </select>
            </label>
            <Text name="organizer" label="Organizer" />
            <Text
              name="requests"
              label="Additional requests (manual follow-up)"
              required={false}
            />
            <Schedule />
            <button disabled={busy} className={button}>
              Record inquiry
            </button>
          </form>
          <details>
            <summary>Check a quote and availability</summary>
            <form
              className="space-y-3"
              onSubmit={(event) => void send(event, "quote")}
            >
              <Schedule />
              <button disabled={busy} className={button}>
                Check quote
              </button>
            </form>
          </details>
        </>
      )}
      {tab === "settings" && settings && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          key={revision}
          onSubmit={(event) => void send(event, "actions/settings")}
        >
          {Object.entries(settingsLabels).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                className={field}
                name={key}
                type="number"
                min="0"
                required
                defaultValue={settings[key]}
              />
            </label>
          ))}
          <button disabled={busy} className={button}>
            Save settings
          </button>
        </form>
      )}
      {tab === "calendar" && (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => void send(event, "actions/ready")}
          >
            <Text name="reason" label="Cleaning and readiness confirmation" />
            <button disabled={busy} className={button}>
              Mark hall ready
            </button>
          </form>
          {!settings && !message && <p role="status">Loading calendar…</p>}
          {settings && entries.length === 0 && (
            <p>No reservations on this page.</p>
          )}
          {entries.map((row) => {
            const end = row.quote ? Date.parse(row.quote.end) : null;
            const start = row.quote ? Date.parse(row.quote.start) : null;
            const left = end === null ? null : Math.ceil((end - now) / 60000);
            const possibleNoShow =
              row.status === "confirmed" &&
              start !== null &&
              now >= start + (settings?.noShowGrace ?? 60) * 60000;
            return (
              <article
                key={row.id}
                className="space-y-2 rounded-xl border border-subtle p-4"
              >
                <h3 className="font-semibold">
                  {row.organizer} · {row.status.replaceAll("_", " ")}
                </h3>
                <p>
                  {row.channel.replaceAll("_", " ")} ·{" "}
                  {row.quote
                    ? hotel.format(new Date(row.quote.start)) +
                      " – " +
                      hotel.format(new Date(row.quote.end))
                    : row.quote_input.start.replace("T", " ") +
                      " Manila (inquiry)"}
                </p>
                <p>
                  Price{" "}
                  {pesos(
                    BigInt(row.total) + BigInt(row.overtime) > 0n
                      ? String(BigInt(row.total) + BigInt(row.overtime))
                      : "0",
                  )}{" "}
                  · Verified {pesos(row.collected)} · Refunded{" "}
                  {pesos(row.refunded)} · Balance {pesos(row.balance)}
                </p>
                <p>
                  Includes air-conditioning, sound system and mineral water.
                </p>
                {row.requests && (
                  <p className="break-words">Requests: {row.requests}</p>
                )}
                {row.payment_resolution && (
                  <p className="font-medium">Payment needs staff resolution.</p>
                )}
                {row.preparation_conflict && (
                  <p role="alert">
                    Preparation is due while the hall is occupied.
                  </p>
                )}
                {row.status === "in_progress" && left !== null && (
                  <p>
                    {left <= 0
                      ? "Overdue. Record actual completion."
                      : left +
                        " minutes remaining" +
                        (left <= (settings?.reminder ?? 15)
                          ? " · Ending soon"
                          : "")}
                  </p>
                )}
                {possibleNoShow && (
                  <p>Potential no-show. Staff review required.</p>
                )}
                {row.status === "completed" &&
                  row.actual_end &&
                  end !== null &&
                  Date.parse(row.actual_end) > end && (
                    <p>Unapproved overrun recorded.</p>
                  )}
              </article>
            );
          })}
          <div className="flex gap-4">
            {page > 1 && (
              <button onClick={() => setPage((v) => v - 1)}>Previous</button>
            )}
            {entries.length === 50 && (
              <button onClick={() => setPage((v) => v + 1)}>Next</button>
            )}
          </div>
          <form
            className="space-y-3 rounded-xl border border-subtle p-4"
            onSubmit={(event) => void send(event, "actions/" + action)}
          >
            <label>
              Reservation
              <select name="id" required className={field}>
                <option value="">Choose reservation</option>
                {entries.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.organizer} · {r.quote_input.start} · {r.status}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Action
              <select
                className={field}
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                {[
                  "receipt",
                  "confirm",
                  "reschedule",
                  "extend",
                  "start",
                  "complete",
                  "no_show",
                  "release",
                  "cancel",
                  "approve_refund",
                  "complete_refund",
                  "overtime",
                ].map((a) => (
                  <option key={a} value={a}>
                    {a.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            {action === "reschedule" && <Schedule />}
            {[
              "reschedule",
              "extend",
              "no_show",
              "release",
              "cancel",
              "approve_refund",
              "overtime",
            ].includes(action) && (
              <Text name="reason" label="Documented reason" />
            )}
            {action === "extend" && (
              <Text name="hours" label="Additional full hours" type="number" />
            )}
            {["receipt", "approve_refund", "overtime"].includes(action) && (
              <Text name="amount" label="Amount in centavos" type="number" />
            )}
            {action === "complete_refund" && (
              <Text name="approval" label="Refund approval reference" />
            )}
            {["receipt", "complete_refund"].includes(action) && (
              <>
                <label>
                  Method
                  <select className={field} name="method">
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                  </select>
                </label>
                <Text
                  name="reference"
                  label="GCash transaction reference"
                  required={false}
                />
                <Text
                  name={action === "receipt" ? "receivedAt" : "transferredAt"}
                  label="Actual Manila transaction date and time"
                  type="datetime-local"
                />
                <Text name="evidence" label="Verification note" />
                <label className="block">
                  <input name="verified" type="checkbox" required /> Actual cash
                  or receiving-account transaction verified
                </label>
              </>
            )}
            <button disabled={busy} className={button}>
              Record action
            </button>
          </form>
        </>
      )}
      {tab === "reports" && (
        <>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(event) => void send(event, "reports")}
          >
            <Text name="from" label="From (Manila)" type="date" />
            <Text name="to" label="Through (Manila)" type="date" />
            <button disabled={busy} className={button}>
              View report
            </button>
          </form>
          {report && (
            <section aria-label="Hall report" className="space-y-3">
              <p>
                Gross collections {pesos(report.gross)} · Completed refunds{" "}
                {pesos(report.refunds)} · Net Collections {pesos(report.net)}
              </p>
              <p>
                {report.utilization.bookings} bookings ·{" "}
                {report.utilization.scheduled_minutes} scheduled event minutes ·{" "}
                {report.utilization.actual_minutes} actual occupied minutes ·{" "}
                {report.utilization.preparation_minutes} setup minutes ·{" "}
                {report.utilization.cleanup_minutes} cleanup minutes
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr>
                      {["Manila day", "Gross", "Refunds", "Net"].map(
                        (label) => (
                          <th key={label} scope="col">
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {report.days.map((day) => (
                      <tr key={day.day}>
                        <th scope="row">{day.day}</th>
                        <td>{pesos(day.gross)}</td>
                        <td>{pesos(day.refunds)}</td>
                        <td>{pesos(day.net)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </section>
  );
}
