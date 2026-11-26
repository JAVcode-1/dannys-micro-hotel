import React from "react";
import { apiBase } from "./staff-auth";

type Money = { gross: string; refunds: string; net: string };
type HallReport = Money & {
  days: (Money & { day: string })[];
  utilization: {
    bookings: number;
    scheduled_minutes: number;
    actual_minutes: number;
    preparation_minutes: number;
    cleanup_minutes: number;
  };
};
type Report = {
  overall: Money;
  trends: (Money & { period: string })[];
  categories: (Money & {
    name: string | null;
    packages: Money;
    additional: Money;
    unclassified: Money;
  })[];
  packages: (Money & {
    category: string;
    id: string;
    version: number;
    duration: number;
    price: string;
    originals: number;
    extensions: number;
  })[];
};

function pesos(value: string) {
  const centavos = BigInt(value);
  const absolute = centavos < 0n ? -centavos : centavos;
  return (
    (centavos < 0n ? "−" : "") +
    "₱" +
    (absolute / 100n).toLocaleString("en-PH") +
    "." +
    String(absolute % 100n).padStart(2, "0")
  );
}

const money = (row: Money) => [
  pesos(row.gross),
  pesos(row.refunds),
  pesos(row.net),
];

function Table({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  return (
    <section className="staff-management-card space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {rows.length ? (
        <div
          className="staff-management-table overflow-x-auto"
          role="region"
          aria-label={title + " table"}
          tabIndex={0}
        >
          <table
            aria-label={title}
            className="w-full whitespace-nowrap text-sm"
          >
            <thead className="bg-canvas">
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="px-4 py-3 text-left">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-subtle">
                  {row.map((value, j) =>
                    j === 0 ? (
                      <th
                        key={j}
                        scope="row"
                        className="px-4 py-3 text-left font-medium"
                      >
                        {value}
                      </th>
                    ) : (
                      <td key={j} className="px-4 py-3 tabular-nums">
                        {columns[j] === "Package" ? (
                          <details>
                            <summary className="min-h-11 cursor-pointer text-primary">
                              Package {value.slice(0, 8).toUpperCase()}
                            </summary>
                            <span className="break-all">{value}</span>
                          </details>
                        ) : (
                          value
                        )}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">
          No activity for the selected filters.
        </p>
      )}
    </section>
  );
}

function RoomAnalytics({ token }: { token: string }) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Manila",
    dateStyle: "short",
  }).format(new Date());
  const [query, setQuery] = React.useState(() =>
    new URLSearchParams({
      from: today.slice(0, 8) + "01",
      through: today,
      grain: "day",
    }).toString(),
  );
  const [state, setState] = React.useState<{
    query: string;
    report?: Report;
    error?: string;
  }>();
  const report = state?.query === query ? state.report : undefined;
  const error = state?.query === query ? state.error : undefined;
  React.useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(apiBase + "/staff/analytics?" + query, {
          headers: { Authorization: "Bearer " + token },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error((await response.json()).error);
        const result: Report = await response.json();
        if (!controller.signal.aborted) setState({ query, report: result });
      } catch (cause) {
        if (!controller.signal.aborted)
          setState({
            query,
            error:
              cause instanceof Error
                ? cause.message
                : "Analytics is unavailable.",
          });
      }
    })();
    return () => controller.abort();
  }, [query, token]);
  const filters = new URLSearchParams(query);
  return (
    <section aria-label="Room analytics" className="space-y-4">
      <form
        className="staff-management-card staff-management-fields staff-analytics-fields"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const [key, value] of data)
            if (value) next.set(key, String(value));
          setQuery(next.toString());
        }}
      >
        <label>
          From
          <input
            className="block min-h-11 rounded border border-subtle bg-white px-2"
            name="from"
            type="date"
            required
            defaultValue={filters.get("from") ?? ""}
          />
        </label>
        <label>
          Through
          <input
            className="block min-h-11 rounded border border-subtle bg-white px-2"
            name="through"
            type="date"
            required
            defaultValue={today}
          />
        </label>
        <label>
          Trend
          <select
            name="grain"
            className="block min-h-11 rounded border border-subtle bg-white px-2"
          >
            <option value="day">Daily</option>
            <option value="week">Weekly</option>
            <option value="month">Monthly</option>
          </select>
        </label>
        <label>
          Package category
          <select
            name="category"
            className="block min-h-11 rounded border border-subtle bg-white px-2"
            defaultValue=""
          >
            <option value="">All categories</option>
            {Array.from(
              new Set([
                filters.get("category"),
                ...(report?.categories.map((row) => row.name) ?? []),
                ...(report?.packages.map((row) => row.category) ?? []),
              ]),
            )
              .filter((name): name is string => Boolean(name))
              .map((name) => (
                <option key={name}>{name}</option>
              ))}
          </select>
        </label>
        <button className="min-h-11 rounded bg-primary px-4 text-white">
          Apply filters
        </button>
      </form>
      {error ? (
        <p role="alert">{error}</p>
      ) : !report ? (
        <p role="status">Loading analytics…</p>
      ) : (
        <>
          <dl className="staff-management-totals">
            {["Gross collections", "Completed refunds", "Net Collections"].map(
              (label, i) => (
                <div key={label} className="staff-management-card">
                  <dt>{label}</dt>
                  <dd className="break-all text-xl font-semibold">
                    {money(report.overall)[i]}
                  </dd>
                </div>
              ),
            )}
          </dl>
          <Table
            title="Collection trends"
            columns={["Period (Manila)", "Gross", "Refunds", "Net Collections"]}
            rows={report.trends.map((row) => [row.period, ...money(row)])}
          />
          <Table
            title="Room category performance"
            columns={[
              "Category",
              "Gross",
              "Refunds",
              "Net Collections",
              "Packages net",
              "Additional charges net",
              "Unclassified net",
            ]}
            rows={report.categories.map((row) => [
              row.name ?? "Unattributed",
              ...money(row),
              pesos(row.packages.net),
              pesos(row.additional.net),
              pesos(row.unclassified.net),
            ])}
          />
          <Table
            title="Package popularity"
            columns={[
              "Category",
              "Package",
              "Version",
              "Duration",
              "Package price",
              "Original purchases",
              "Extensions",
              "Net Collections",
            ]}
            rows={report.packages.map((row) => [
              row.category,
              row.id,
              String(row.version),
              row.duration + " min",
              pesos(row.price),
              String(row.originals),
              String(row.extensions),
              pesos(row.net),
            ])}
          />
        </>
      )}
    </section>
  );
}

function HallAnalytics({ token }: { token: string }) {
  const [filters, setFilters] = React.useState<URLSearchParams>();
  const [result, setResult] = React.useState<{
    filters: URLSearchParams;
    report?: HallReport;
    error?: string;
  }>();
  const report = result?.filters === filters ? result?.report : undefined;
  const error = result?.filters === filters ? result?.error : undefined;

  React.useEffect(() => {
    if (!filters) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(
          `${apiBase}/staff/hall/reports?${filters}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error ?? "Function Hall report unavailable.");
        if (!controller.signal.aborted) setResult({ filters, report: data });
      } catch (cause) {
        if (!controller.signal.aborted)
          setResult({
            filters,
            error:
              cause instanceof Error
                ? cause.message
                : "Function Hall report unavailable.",
          });
      }
    })();
    return () => controller.abort();
  }, [filters, token]);

  return (
    <section aria-label="Function Hall report" className="space-y-4">
      <form
        className="staff-management-card staff-management-fields staff-analytics-fields"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          setFilters(
            new URLSearchParams({
              from: String(form.get("from")),
              to: String(form.get("to")),
            }),
          );
        }}
      >
        <label>
          From (Manila)
          <input
            className="block min-h-11 rounded border border-subtle bg-white px-2"
            name="from"
            type="date"
            required
          />
        </label>
        <label>
          Through (Manila)
          <input
            className="block min-h-11 rounded border border-subtle bg-white px-2"
            name="to"
            type="date"
            required
          />
        </label>
        <button
          className="min-h-11 rounded bg-primary px-4 text-white disabled:opacity-50"
          disabled={!!filters && !report && !error}
        >
          View report
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {filters && !error && !report && (
        <p role="status">Loading Function Hall report…</p>
      )}
      {report && (
        <>
          <dl className="staff-management-totals">
            {["Gross collections", "Completed refunds", "Net Collections"].map(
              (label, index) => (
                <div key={label} className="staff-management-card">
                  <dt>{label}</dt>
                  <dd className="break-all text-xl font-semibold">
                    {money(report)[index]}
                  </dd>
                </div>
              ),
            )}
          </dl>
          <p className="staff-management-card text-sm">
            {report.utilization.bookings} bookings ·{" "}
            {report.utilization.scheduled_minutes} scheduled event minutes ·{" "}
            {report.utilization.actual_minutes} actual occupied minutes ·{" "}
            {report.utilization.preparation_minutes} setup minutes ·{" "}
            {report.utilization.cleanup_minutes} cleanup minutes
          </p>
          <Table
            title="Daily Hall collections"
            columns={["Manila day", "Gross", "Refunds", "Net Collections"]}
            rows={report.days.map((day) => [day.day, ...money(day)])}
          />
        </>
      )}
    </section>
  );
}

export default function StaffAnalytics({
  token,
  hallEnabled = false,
}: {
  token: string;
  hallEnabled?: boolean;
}) {
  const [hallSelected, setHallSelected] = React.useState(false);
  const showingHall = hallEnabled && hallSelected;

  return (
    <section className="staff-management space-y-4">
      <h2 className="text-2xl font-semibold">Analytics</h2>
      {hallEnabled && (
        <nav aria-label="Analytics reports" className="staff-management-tabs">
          {(
            [
              ["Rooms", false],
              ["Function Hall", true],
            ] as const
          ).map(([label, hall]) => (
            <button
              key={label}
              type="button"
              aria-pressed={showingHall === hall}
              onClick={() => setHallSelected(hall)}
              className="min-h-11 rounded-lg border border-subtle px-4 font-semibold text-primary aria-pressed:bg-selected"
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      <div hidden={showingHall}>
        <RoomAnalytics token={token} />
      </div>
      {hallEnabled && (
        <div hidden={!showingHall}>
          <HallAnalytics key={token} token={token} />
        </div>
      )}
    </section>
  );
}
