import writeXlsx from "write-excel-file/node";
import type { calculateAnalytics } from "./analytics-report.js";
import { BookingError } from "./booking-quote.js";

type Report = ReturnType<typeof calculateAnalytics>;

export async function exportAnalytics(report: Report, format: "csv" | "xlsx") {
  const groups = [
    ["Overall", [{ label: "All collections", ...report.overall }]],
    ["Trend", report.trends.map((r) => ({ label: r.period, ...r }))],
    [
      "Category",
      report.categories.flatMap((r) => {
        const label = r.name ?? "Unattributed";
        return [
          { label, ...r },
          { label: label + " / Packages", ...r.packages },
          { label: label + " / Additional charges", ...r.additional },
          { label: label + " / Unclassified", ...r.unclassified },
        ];
      }),
    ],
    [
      "Package",
      report.packages.map((r) => ({
        label: [r.category, r.id, r.version, r.duration, r.price].join(" / "),
        ...r,
      })),
    ],
  ] as const;
  const rows = groups.flatMap(([section, entries]) =>
    entries.map((r) => [
      section,
      r.label,
      r.gross,
      r.refunds,
      r.net,
      "originals" in r ? r.originals : "",
      "extensions" in r ? r.extensions : "",
    ]),
  );
  if (rows.length > 10000)
    throw new BookingError("Analytics export exceeds 10,000 rows.", 422);
  const header = [
    "Report",
    "Label",
    "Gross centavos",
    "Refund centavos",
    "Net centavos",
    "Original purchases",
    "Purchased extensions",
  ];
  if (format === "csv") {
    const quote = (value: string) => '"' + value.replaceAll('"', '""') + '"';
    return Buffer.from(
      [
        header.map(quote).join(","),
        ...rows.map((row) =>
          row
            .map((value, i) =>
              i < 2
                ? quote(
                    String(value).replace(
                      /^(?=[\s\p{Cc}]*[=+\-@]|[\t\r\n])/u,
                      "'",
                    ),
                  )
                : String(value),
            )
            .join(","),
        ),
      ].join("\r\n"),
    );
  }
  return writeXlsx([
    header,
    ...rows.map((row) =>
      row.map((value, i) => {
        if (i < 2 || value === "") return String(value);
        const number = Number(value);
        if (!Number.isSafeInteger(number) || Math.abs(number) >= 1e15) {
          throw new BookingError(
            "Analytics export exceeds Excel numeric precision.",
            422,
          );
        }
        return number;
      }),
    ),
  ]).toBuffer();
}
