import { readableLabel } from "./presentation";
import React from "react";
import type { StaffAuditPage } from "@staytrack/shared";
import { apiBase } from "./staff-auth";

const auditTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "medium",
  hour12: true,
});

export default function StaffAuditDesk({ token }: { token: string }) {
  const [search, setSearch] = React.useState({ filters: "", cursor: "" });
  const [page, setPage] = React.useState<StaffAuditPage | null>(null);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(search.filters);
    if (search.cursor) query.set("cursor", search.cursor);
    setLoading(true);
    setError("");
    setPage(null);
    void (async () => {
      try {
        const response = await fetch(`${apiBase}/staff/audit?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            response.status === 400
              ? "Check the filters and date range."
              : "Audit search is unavailable. Try again.",
          );
        const data: StaffAuditPage = await response.json();
        if (!controller.signal.aborted) setPage(data);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : "Audit search is unavailable.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [search, token]);

  const field =
    "mt-1 min-h-11 w-full rounded-lg border border-subtle bg-white px-3";
  return (
    <section className="staff-management space-y-4">
      <h2 className="text-xl font-semibold">Activity log</h2>
      <details className="staff-management-card">
        <summary className="min-h-11 cursor-pointer font-semibold text-primary">
          Filter activity
        </summary>
        <form
          className="staff-management-fields staff-audit-fields"
          onSubmit={(event) => {
            event.preventDefault();
            const filters = new URLSearchParams();
            for (const [key, value] of new FormData(event.currentTarget)) {
              const text = String(value).trim();
              if (text) filters.set(key, text);
            }
            setSearch({ filters: filters.toString(), cursor: "" });
          }}
        >
          <label>
            Actor ID
            <input
              className={field}
              name="actor"
              maxLength={36}
              placeholder="Full staff ID"
            />
          </label>
          <label>
            Action
            <input
              className={field}
              name="action"
              maxLength={80}
              placeholder="e.g. room.maintenance.open"
            />
          </label>
          <label>
            Subject type
            <select className={field} name="subjectType">
              <option value="">All subjects</option>
              <option value="room">Physical room</option>
              <option value="room_item">Room item</option>
              <option value="payment_submission">Payment submission</option>
              <option value="hall_reservation">
                Function Hall reservation
              </option>
              <option value="review">Guest review</option>
              <option value="feedback">Private feedback</option>
            </select>
          </label>
          <label>
            Subject ID
            <input className={field} name="subjectId" maxLength={36} />
          </label>
          <label>
            From date (Manila)
            <input className={field} name="from" type="date" />
          </label>
          <label>
            Through date (Manila)
            <input className={field} name="to" type="date" />
          </label>
          <div className="staff-management-wide">
            <button
              className="min-h-11 rounded-lg bg-primary px-4 py-2 font-semibold text-white"
              type="submit"
            >
              Search audit
            </button>
          </div>
        </form>
      </details>
      {loading && <p role="status">Loading audit activity…</p>}
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {page && page.entries.length === 0 && (
        <p className="staff-management-card staff-empty">
          No matching audit entries.
        </p>
      )}
      {page && page.entries.length > 0 && (
        <div className="staff-management-card">
          <div
            className="staff-management-table overflow-x-auto"
            role="region"
            aria-label="Audit activity"
            tabIndex={0}
          >
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Staff audit results in Manila time
              </caption>
              <thead>
                <tr>
                  {["Manila time", "Action", "Actor ID", "Subject"].map(
                    (label) => (
                      <th key={label} scope="col" className="p-2">
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {page.entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-subtle">
                    <td className="p-2">
                      <time dateTime={entry.occurredAt}>
                        {auditTime.format(new Date(entry.occurredAt))}
                      </time>
                    </td>
                    <td className="p-2">
                      {readableLabel(entry.action.replaceAll(".", " "))}
                    </td>
                    <td className="p-2">
                      <details>
                        <summary className="min-h-11 cursor-pointer">
                          Staff {entry.actorId.slice(0, 8).toUpperCase()}
                        </summary>
                        <span className="break-all">{entry.actorId}</span>
                      </details>
                    </td>
                    <td className="break-all p-2">
                      {entry.subjectType ? (
                        <details>
                          <summary className="min-h-11 cursor-pointer">
                            {readableLabel(entry.subjectType)}{" "}
                            {entry.subjectId?.slice(0, 8).toUpperCase()}
                          </summary>
                          <span className="break-all">{entry.subjectId}</span>
                        </details>
                      ) : (
                        "No subject recorded"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {page?.nextCursor && (
        <button
          type="button"
          className="min-h-11 rounded-lg border border-subtle px-4 text-primary"
          onClick={() =>
            setSearch((current) => ({ ...current, cursor: page.nextCursor! }))
          }
        >
          Next page
        </button>
      )}
    </section>
  );
}
