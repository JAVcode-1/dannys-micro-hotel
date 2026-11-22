import React from "react";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";

type Money = { gross: string; refunds: string; net: string };
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
    <section className="space-y-3">
      <h3 className="text-lg font-semibold">{title}</h3>
      {rows.length ? (
        <div className="overflow-x-auto">
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
                        {value}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No activity for the selected filters.</p>
      )}
    </section>
  );
}

export default function StaffAnalytics({ token }: { token: string }) {
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
  const [download, setDownload] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const downloadRequest = React.useRef<AbortController | null>(null);
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
    return () => {
      controller.abort();
      downloadRequest.current?.abort();
    };
  }, [query, token]);
  async function getExport(format: string) {
    const controller = new AbortController();
    downloadRequest.current = controller;
    setBusy(true);
    setDownload("");
    try {
      const response = await fetch(
        apiBase + "/staff/analytics/export?" + query + "&format=" + format,
        {
          headers: { Authorization: "Bearer " + token },
          signal: controller.signal,
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "staytrack-analytics." + format;
      link.click();
      notifySuccess("Analytics export download started.");
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      if (!controller.signal.aborted)
        setDownload(
          cause instanceof Error ? cause.message : "Download is unavailable.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const filters = new URLSearchParams(query);
  const money = (row: Money) => [
    pesos(row.gross),
    pesos(row.refunds),
    pesos(row.net),
  ];
  return (
    <section className="mt-8 space-y-6">
      <h2 className="text-2xl font-semibold">Analytics</h2>
      <form
        className="flex flex-wrap items-end gap-4 rounded-xl bg-canvas p-4"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const [key, value] of data)
            if (value) next.set(key, String(value));
          setBusy(false);
          setDownload("");
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
          <div className="flex flex-wrap gap-3">
            {["csv", "xlsx"].map((format) => (
              <button
                key={format}
                type="button"
                disabled={busy}
                className="min-h-11 rounded border border-subtle px-4 text-primary disabled:opacity-50"
                onClick={() => void getExport(format)}
              >
                Download {format.toUpperCase()}
              </button>
            ))}
          </div>
          {download && <p role="alert">{download}</p>}
          <dl className="grid gap-3 sm:grid-cols-3">
            {["Gross collections", "Completed refunds", "Net Collections"].map(
              (label, i) => (
                <div key={label} className="rounded-xl bg-canvas p-4">
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
            columns={[
              "Manila period start",
              "Gross",
              "Refunds",
              "Net Collections",
            ]}
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
              "Recorded price",
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
