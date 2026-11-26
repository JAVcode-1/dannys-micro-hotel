import type { CSSProperties } from "react";
import { readableLabel } from "./presentation";

export type PackagePurchase = {
  id: string;
  category: string;
  version: number;
  duration: number;
  price: string;
  originals: number;
  extensions: number;
};

export function pesos(value: string | bigint) {
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

function axisLimit(amount: bigint) {
  if (amount === 0n) return 0n;
  const increment = 10n ** BigInt(amount.toString().length - 1);
  return (amount / increment + 1n) * increment;
}

function netScale(values: bigint[], addHeadroom = false) {
  let minimum = 0n;
  let maximum = 0n;
  for (const value of values) {
    if (value < minimum) minimum = value;
    if (value > maximum) maximum = value;
  }
  if (addHeadroom) {
    minimum = -axisLimit(-minimum);
    maximum = axisLimit(maximum);
    if (minimum === maximum) maximum = 100n;
  }
  const span = maximum - minimum || 1n;
  const percent = (amount: bigint) =>
    `${Number((amount * 10000n) / span) / 100}%`;
  return {
    minimum,
    maximum,
    zero: percent(-minimum),
    start: (value: bigint) => percent((value < 0n ? value : 0n) - minimum),
    extent: (value: bigint) => percent(value < 0n ? -value : value),
  };
}

function RankingAxis({ start, end }: { start: string; end: string }) {
  return (
    <div className="staff-chart-axis tabular-nums" aria-hidden="true">
      <span>{start}</span>
      <span>{end}</span>
    </div>
  );
}

const shortDay = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "short",
  day: "numeric",
});
const shortMonth = new Intl.DateTimeFormat("en-PH", {
  timeZone: "UTC",
  month: "short",
  year: "numeric",
});
const compactAmount = new Intl.NumberFormat("en-PH", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function CollectionsChart({
  rows,
  grain = "day",
  label = "Net collections by period",
}: {
  rows: { period: string; net: string }[];
  grain?: string | null;
  label?: string;
}) {
  const values = rows.map((row) => BigInt(row.net));
  const scale = netScale(values);
  const dateFormat = grain === "month" ? shortMonth : shortDay;
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className="staff-chart-scroll"
    >
      <ul
        role="list"
        className="staff-chart-periods tabular-nums"
        style={{ "--chart-zero": scale.zero } as CSSProperties}
      >
        {rows.map(({ period }, index) => {
          const value = values[index];
          const exact = pesos(value);
          const displayed =
            value <= -100000n || value >= 100000n
              ? (value < 0n ? "−" : "") +
                "₱" +
                compactAmount.format((value < 0n ? -value : value) / 100n)
              : exact;
          return (
            <li
              key={period}
              aria-label={`${period}: ${exact}`}
              title={`${period} · ${exact}`}
            >
              <span aria-hidden="true" className="staff-chart-value">
                {displayed}
              </span>
              <div aria-hidden="true" className="staff-chart-plot">
                {value !== 0n && (
                  <span
                    className="staff-chart-mark"
                    data-negative={value < 0n}
                    style={{
                      bottom: scale.start(value),
                      height: scale.extent(value),
                    }}
                  />
                )}
              </div>
              <time dateTime={period} aria-hidden="true">
                {dateFormat.format(new Date(period + "T00:00:00Z"))}
              </time>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CategoryCollectionsChart({
  rows,
}: {
  rows: { name: string | null; net: string }[];
}) {
  const categories = rows.map(({ name, net }) => ({
    key: name ?? "",
    name: name === null ? "Unattributed" : readableLabel(name),
    net: BigInt(net),
  }));
  categories.sort((a, b) =>
    a.net === b.net ? a.name.localeCompare(b.name) : a.net > b.net ? -1 : 1,
  );
  const scale = netScale(
    categories.map(({ net }) => net),
    true,
  );
  return (
    <div className="staff-chart-breakdown">
      {categories.length === 1 && (
        <p className="staff-chart-note">
          One category with recorded activity in this period.
        </p>
      )}
      <ul
        role="list"
        aria-label="Net collections by room category"
        className="staff-chart-ranking"
        style={{ "--chart-zero": scale.zero } as CSSProperties}
      >
        {categories.map(({ key, name, net }) => (
          <li key={key}>
            <div className="staff-chart-row">
              <span>{name}</span>
              <span className="tabular-nums">{pesos(net)}</span>
            </div>
            <div
              className="staff-chart-track staff-chart-signed"
              aria-hidden="true"
            >
              {net !== 0n && (
                <span
                  className="staff-chart-mark"
                  data-negative={net < 0n}
                  style={{ left: scale.start(net), width: scale.extent(net) }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
      <RankingAxis start={pesos(scale.minimum)} end={pesos(scale.maximum)} />
    </div>
  );
}

export function PackagePopularityChart({ rows }: { rows: PackagePurchase[] }) {
  const labelCounts = new Map<string, number>();
  const ranked = rows
    .filter(({ originals, extensions }) => originals > 0 || extensions > 0)
    .map((row) => {
      const label = `${readableLabel(row.category)} · ${row.duration / 60} hours`;
      labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      return { ...row, label };
    })
    .sort(
      (a, b) =>
        b.originals - a.originals ||
        b.extensions - a.extensions ||
        a.label.localeCompare(b.label) ||
        b.version - a.version,
    );
  if (ranked.length === 0)
    return (
      <p className="text-sm text-muted">
        No package purchases or extensions for the selected filters.
      </p>
    );
  const largestTotal = ranked.reduce(
    (largest, row) => Math.max(largest, row.originals + row.extensions),
    0,
  );
  const maximum = Math.ceil((largestTotal + 1) / 4) * 4;
  return (
    <>
      <div className="staff-chart-legend">
        <span>
          <i aria-hidden="true" /> Original purchases
        </span>
        <span>
          <i aria-hidden="true" /> Extensions
        </span>
      </div>
      <div className="staff-chart-breakdown">
        {ranked.length === 1 && (
          <p className="staff-chart-note">
            One package with purchases or extensions in this period.
          </p>
        )}
        <ul
          role="list"
          className="staff-chart-ranking"
          aria-label="Packages ranked by original purchases"
        >
          {ranked.map(
            ({
              id,
              category,
              duration,
              price,
              label,
              version,
              originals,
              extensions,
            }) => (
              <li
                key={JSON.stringify([category, id, duration, version, price])}
                title={`Version ${version} · ${pesos(price)}`}
              >
                <div className="staff-chart-row">
                  <span>
                    {(labelCounts.get(label) ?? 0) > 1
                      ? `${label} · v${version}`
                      : label}
                  </span>
                  <span className="tabular-nums">
                    <span aria-hidden="true">
                      {originals} + {extensions}
                    </span>
                    <span className="sr-only">
                      {originals} original{" "}
                      {originals === 1 ? "purchase" : "purchases"}, {extensions}{" "}
                      {extensions === 1 ? "extension" : "extensions"}
                    </span>
                  </span>
                </div>
                <div
                  className="staff-chart-track staff-chart-stack"
                  aria-hidden="true"
                >
                  <span style={{ width: `${(100 * originals) / maximum}%` }} />
                  <span style={{ width: `${(100 * extensions) / maximum}%` }} />
                </div>
              </li>
            ),
          )}
        </ul>
        <RankingAxis
          start="0"
          end={`${maximum.toLocaleString("en-PH")} purchases`}
        />
      </div>
    </>
  );
}
