import {
  purchaseDate,
  replayCollections,
  splitCentavos,
} from "./analytics-calculator.js";
import type { CollectionHistory } from "./analytics-calculator.js";
import type { loadAnalyticsRows } from "./analytics-data.js";

type Rows = Awaited<ReturnType<typeof loadAnalyticsRows>>;
type Grain = "day" | "week" | "month";

function snapshot(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((p) => {
    if (
      !p ||
      !Number.isSafeInteger(p.priceCentavos) ||
      p.priceCentavos < 0 ||
      !Number.isSafeInteger(p.durationMinutes) ||
      p.durationMinutes <= 0 ||
      (typeof p.id !== "number" && typeof p.id !== "string") ||
      !Number.isSafeInteger(p.version)
    )
      return [];
    return [
      {
        id: String(p.id),
        version: p.version as number,
        duration: p.durationMinutes as number,
        price: BigInt(p.priceCentavos),
      },
    ];
  });
}

export function calculateAnalytics(
  rows: Rows,
  from: string,
  end: string,
  grain: Grain,
  category?: string,
) {
  const charges: CollectionHistory["charges"] = [];
  const allocations: CollectionHistory["allocations"] = [];
  const packages = new Map<
    string,
    {
      category: string;
      id: string;
      version: number;
      duration: number;
      price: string;
      originals: number;
      extensions: number;
      gross: bigint;
      refunds: bigint;
    }
  >();
  const packageByCharge = new Map<string, string>();
  const extra = new Set<string>();
  const items = new Map(rows.items.map((item) => [item.id, item]));
  const funding = new Map<string, { at: string; amount: bigint }[]>();
  for (const p of rows.payments) {
    if (!p.id.startsWith("stay:")) {
      const events = funding.get(p.reservation_id) ?? [];
      events.push({ at: p.recorded, amount: BigInt(p.amount) });
      funding.set(p.reservation_id, events);
    }
  }
  function addPackages(
    item: Rows["items"][number],
    key: string,
    data: unknown,
    at: string,
    date: string | null,
    extension: boolean,
    authoritativeAmount: bigint,
  ) {
    const parsed = snapshot(data);
    const priced = parsed.reduce((sum, line) => sum + line.price, 0n);
    const valid = priced <= authoritativeAmount;
    const lines = (valid ? parsed : []).map((p, index) => {
      const id = key + ":" + String(index).padStart(2, "0");
      const group = JSON.stringify([
        item.category,
        p.id,
        p.version,
        p.duration,
        p.price.toString(),
      ]);
      const entry = packages.get(group) ?? {
        category: item.category,
        id: p.id,
        version: p.version,
        duration: p.duration,
        price: p.price.toString(),
        originals: 0,
        extensions: 0,
        gross: 0n,
        refunds: 0n,
      };
      if (date && date >= from && date < end) {
        if (extension) entry.extensions++;
        else entry.originals++;
      }
      packages.set(group, entry);
      packageByCharge.set(id, group);
      const line = { id, item: item.id, at, amount: p.price };
      charges.push(line);
      return line;
    });
    const missing = authoritativeAmount - (valid ? priced : 0n);
    if (missing > 0n) {
      const line = { id: key + ":unknown", item: item.id, at, amount: missing };
      charges.push(line);
      lines.push(line);
    }
    return lines;
  }
  for (const item of rows.items) {
    const online = item.channel === "online";
    const approvedAt = online ? item.confirmation : item.check_in;
    const date = approvedAt
      ? purchaseDate(
          {
            kind: online ? "online" : "walkin",
            approvedAt,
            price: BigInt(item.total),
            cancelledAt: item.cancellation ?? undefined,
            funding: funding.get(item.reservation) ?? [],
          },
          end,
        )
      : null;
    addPackages(
      item,
      item.id,
      item.snapshot,
      item.at,
      date,
      false,
      BigInt(item.base),
    );
    const id = item.id + ":bed";
    extra.add(id);
    charges.push({
      id,
      item: item.id,
      at: item.at,
      amount: BigInt(item.extra),
    });
  }
  const extensionAllocations = new Map<string, Rows["allocations"]>();
  for (const a of rows.allocations) {
    if (a.released && a.released < end) continue;
    if (a.extension) {
      const entries = extensionAllocations.get(a.extension) ?? [];
      entries.push(a);
      extensionAllocations.set(a.extension, entries);
    } else if (a.charge) {
      allocations.push({ ...a, charge: a.charge, amount: BigInt(a.amount) });
    }
  }
  for (const e of rows.extensions) {
    const item = items.get(e.item);
    if (!item) throw new Error("Extension item missing");
    const entries = (extensionAllocations.get(e.id) ?? []).sort(
      (a, b) => a.at.localeCompare(b.at) || a.receipt.localeCompare(b.receipt),
    );
    const date = e.approval
      ? purchaseDate(
          {
            kind: "extension",
            price: BigInt(e.amount),
            approvedAt: e.approval,
            funding: entries.map((a) => ({
              at: a.at,
              amount: BigInt(a.amount),
            })),
          },
          end,
        )
      : null;
    const lines = date
      ? addPackages(
          item,
          e.id,
          e.snapshot,
          date,
          item.cancellation && item.cancellation < end ? null : date,
          true,
          BigInt(e.amount),
        )
      : [];
    const outstanding = lines.map((line) => line.amount);
    for (const a of entries) {
      const shares = splitCentavos(BigInt(a.amount), outstanding);
      let remainder = BigInt(a.amount);
      for (const [i, share] of shares.entries()) {
        if (share > 0n)
          allocations.push({ ...a, charge: lines[i].id, amount: share });
        outstanding[i] -= share;
        remainder -= share;
      }
      if (remainder > 0n)
        allocations.push({ ...a, charge: e.id, amount: remainder });
    }
  }
  const credits = new Map<
    string,
    NonNullable<CollectionHistory["charges"][number]["credits"]>
  >();
  for (const e of rows.extras) {
    if (!e.credit_of) continue;
    credits.set(e.credit_of, [
      ...(credits.get(e.credit_of) ?? []),
      { ...e, amount: BigInt(e.amount) },
    ]);
  }
  for (const e of rows.extras) {
    if (e.kind === "charge_credit") continue;
    extra.add(e.id);
    charges.push({
      ...e,
      amount: BigInt(e.amount),
      credits: credits.get(e.id),
    });
  }
  const parts = replayCollections(
    {
      items: rows.items,
      charges,
      allocations,
      registry: rows.registry,
      receipts: rows.payments.map((p) => ({
        ...p,
        reservation: p.reservation_id,
        item: p.item ?? undefined,
        gcashReference: p.reference ?? undefined,
        amount: BigInt(p.amount),
      })),
      refunds: rows.refunds.map((r) => ({ ...r, amount: BigInt(r.amount) })),
    },
    from,
    end,
  );
  const totals = () => ({ gross: 0n, refunds: 0n });
  const overall = totals();
  const categories = new Map<
    string | null,
    {
      total: ReturnType<typeof totals>;
      packages: ReturnType<typeof totals>;
      additional: ReturnType<typeof totals>;
      unclassified: ReturnType<typeof totals>;
    }
  >();
  const periods = new Map<string, ReturnType<typeof totals>>();
  const add = (
    target: ReturnType<typeof totals>,
    source: ReturnType<typeof totals>,
  ) => {
    target.gross += source.gross;
    target.refunds += source.refunds;
  };
  for (const part of parts) {
    add(overall, part);
    const local = new Date(Date.parse(part.at) + 8 * 3600000);
    if (grain === "month") local.setUTCDate(1);
    if (grain === "week")
      local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
    const period = local.toISOString().slice(0, 10);
    const trend = periods.get(period) ?? totals();
    add(trend, part);
    periods.set(period, trend);
    const row = categories.get(part.category) ?? {
      total: totals(),
      packages: totals(),
      additional: totals(),
      unclassified: totals(),
    };
    const group = part.charge ? packageByCharge.get(part.charge) : undefined;
    const pkg = group ? packages.get(group) : undefined;
    add(row.total, part);
    if (pkg) {
      add(pkg, part);
      add(row.packages, part);
    } else
      add(
        part.charge && extra.has(part.charge)
          ? row.additional
          : row.unclassified,
        part,
      );
    categories.set(part.category, row);
  }
  const expectedGross = rows.payments
    .filter((p) => p.at >= from && p.at < end)
    .reduce((sum, p) => sum + BigInt(p.amount), 0n);
  const expectedRefunds = rows.refunds.reduce(
    (sum, r) => sum + BigInt(r.amount),
    0n,
  );
  if (overall.gross !== expectedGross || overall.refunds !== expectedRefunds)
    throw new Error("Analytics did not reconcile");
  const money = (row: ReturnType<typeof totals>) => ({
    gross: String(row.gross),
    refunds: String(row.refunds),
    net: String(row.gross - row.refunds),
  });
  return {
    overall: money(overall),
    trends: Array.from(periods, ([period, row]) => ({
      period,
      ...money(row),
    })).sort((a, b) => a.period.localeCompare(b.period)),
    categories: Array.from(categories, ([name, row]) => ({
      name,
      ...money(row.total),
      packages: money(row.packages),
      additional: money(row.additional),
      unclassified: money(row.unclassified),
    })),
    packages: Array.from(packages.values())
      .filter(
        (row) =>
          (!category || row.category === category) &&
          (row.originals || row.extensions || row.gross || row.refunds),
      )
      .map((row) => ({ ...row, ...money(row) })),
  };
}
