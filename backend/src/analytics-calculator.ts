type Item = { id: string; reservation: string; category: string; at: string };
type Money = { id: string; at: string; amount: bigint };
type Charge = Money & { item: string; credits?: readonly Money[] };
type Receipt = Money & {
  reservation: string;
  item?: string;
  gcashReference?: string;
};
type Refund = Money & { receipt: string; item: string };
type Allocation = {
  receipt: string;
  item: string;
  charge: string;
  at: string;
  releasedAt?: string;
  amount: bigint;
};
type Part = { item: string | null; charge: string | null; amount: bigint };
export type CollectionHistory = {
  registry?: ReadonlyMap<string, string>;
  items: Item[];
  charges: Charge[];
  receipts: Receipt[];
  refunds: Refund[];
  allocations: Allocation[];
};

export function purchaseDate(
  purchase: {
    kind: "online" | "walkin" | "extension";
    price: bigint;
    approvedAt: string;
    cancelledAt?: string;
    funding: readonly { at: string; amount: bigint }[];
  },
  end: string,
): string | null {
  if (
    (purchase.kind !== "walkin" && purchase.approvedAt >= end) ||
    (purchase.cancelledAt && purchase.cancelledAt < end)
  )
    return null;
  const minimum =
    purchase.kind === "online" ? purchase.price : (purchase.price + 1n) / 2n;
  if (minimum === 0n)
    return purchase.approvedAt < end ? purchase.approvedAt : null;
  let total = 0n;
  for (const event of [...purchase.funding].sort((a, b) =>
    a.at.localeCompare(b.at),
  )) {
    if (event.at >= end) break;
    total += event.amount;
    if (total >= minimum) {
      if (purchase.kind === "walkin") return event.at;
      return event.at > purchase.approvedAt ? event.at : purchase.approvedAt;
    }
  }
  return null;
}

function group<T>(rows: readonly T[], key: (row: T) => string) {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const id = key(row);
    const bucket = groups.get(id);
    if (bucket) bucket.push(row);
    else groups.set(id, [row]);
  }
  return groups;
}

function uniqueMoney<T extends Money>(rows: readonly T[]) {
  return Array.from(
    group(rows, (row) => row.id).values(),
    ([first, ...rest]) => {
      if (
        rest.some((row) =>
          Object.keys(first).some(
            (key) => row[key as keyof T] !== first[key as keyof T],
          ),
        )
      )
        throw new Error("Conflicting financial event");
      return first;
    },
  );
}

// Timestamps are canonical UTC strings with database precision.
export function replayCollections(
  history: CollectionHistory,
  from: string,
  end: string,
) {
  const items = new Map(history.items.map((item) => [item.id, item]));
  const byReservation = group(history.items, (item) => item.reservation);
  const byItem = group(history.charges, (charge) => charge.item);
  for (const rows of [...byReservation.values(), ...byItem.values()]) {
    rows.sort((a, b) => a.id.localeCompare(b.id));
  }
  const allocations = group(
    history.allocations.filter(
      ({ at, releasedAt }) => at < end && (!releasedAt || releasedAt >= end),
    ),
    (allocation) => allocation.receipt,
  );
  const partsByReceipt = new Map<string, Part[]>();
  const applied = new Map<string, bigint>();
  const receipts = uniqueMoney(history.receipts).filter((row) => row.at < end);
  const reserved = new Map<string, bigint>();
  for (const receipt of receipts) {
    for (const allocation of allocations.get(receipt.id) ?? []) {
      reserved.set(
        allocation.charge,
        (reserved.get(allocation.charge) ?? 0n) + allocation.amount,
      );
    }
  }
  receipts.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  function apply(
    parts: Part[],
    item: string | null,
    charge: string | null,
    amount: bigint,
  ) {
    if (amount === 0n) return;
    parts.push({ item, charge, amount });
  }
  const output: {
    at: string;
    category: string | null;
    item: string | null;
    charge: string | null;
    gross: bigint;
    refunds: bigint;
  }[] = [];
  function emit(part: Part, at: string, refund: boolean) {
    if (at < from || at >= end || part.amount === 0n) return;
    output.push({
      at,
      category: part.item ? (items.get(part.item)?.category ?? null) : null,
      item: part.item,
      charge: part.charge,
      gross: refund ? 0n : part.amount,
      refunds: refund ? part.amount : 0n,
    });
  }
  for (const receipt of receipts) {
    if (
      receipt.gcashReference !== undefined &&
      history.registry?.get(receipt.gcashReference) !== receipt.id
    ) {
      throw new Error("Conflicting GCash registry ownership");
    }
    const parts: Part[] = [];
    let remaining = receipt.amount;
    for (const allocation of allocations.get(receipt.id) ?? []) {
      if (allocation.amount > remaining)
        throw new Error("Overallocated receipt");
      apply(parts, allocation.item, allocation.charge, allocation.amount);
      remaining -= allocation.amount;
    }
    const candidates = (byReservation.get(receipt.reservation) ?? []).filter(
      (item) =>
        item.at <= receipt.at && (!receipt.item || receipt.item === item.id),
    );
    const open = candidates.map((item) =>
      (byItem.get(item.id) ?? [])
        .filter((charge) => charge.at <= receipt.at)
        .map((charge) => {
          const credited = (charge.credits ?? []).reduce(
            (sum, credit) =>
              sum + (credit.at <= receipt.at ? credit.amount : 0n),
            0n,
          );
          const balance =
            charge.amount -
            credited -
            (reserved.get(charge.id) ?? 0n) -
            (applied.get(charge.id) ?? 0n);
          return { id: charge.id, balance: balance > 0n ? balance : 0n };
        }),
    );
    const shares = splitCentavos(
      remaining,
      open.map((charges) =>
        charges.reduce((sum, charge) => sum + charge.balance, 0n),
      ),
    );
    for (const [index, item] of candidates.entries()) {
      const charges = open[index];
      const lines = splitCentavos(
        shares[index],
        charges.map((charge) => charge.balance),
      );
      for (const [line, charge] of charges.entries()) {
        apply(parts, item.id, charge.id, lines[line]);
        applied.set(charge.id, (applied.get(charge.id) ?? 0n) + lines[line]);
      }
      remaining -= shares[index];
    }
    apply(parts, receipt.item ?? null, null, remaining);
    partsByReceipt.set(receipt.id, parts);
    for (const part of parts) emit(part, receipt.at, false);
  }
  for (const refund of uniqueMoney(history.refunds)) {
    const original = (partsByReceipt.get(refund.receipt) ?? []).filter(
      (part) => part.item === refund.item && part.charge !== null,
    );
    const shares = splitCentavos(
      refund.amount,
      original.map((part) => part.amount),
    );
    let remaining = refund.amount;
    for (const [index, part] of original.entries()) {
      emit({ ...part, amount: shares[index] }, refund.at, true);
      remaining -= shares[index];
    }
    emit(
      { item: refund.item, charge: null, amount: remaining },
      refund.at,
      true,
    );
  }
  return output;
}

/** Inputs must be nonnegative and ordered by the caller's stable tie-break key. */
export function splitCentavos(
  amount: bigint,
  balances: readonly bigint[],
): bigint[] {
  const total = balances.reduce((sum, balance) => sum + balance, 0n);
  if (total === 0n) return balances.map(() => 0n);
  const applied = amount < total ? amount : total;
  const shares = balances.map((balance) => (balance * applied) / total);
  let remaining = applied - shares.reduce((sum, share) => sum + share, 0n);
  const priority = balances
    .map((balance, index) => ({
      index,
      remainder: (balance * applied) % total,
    }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  for (const { index } of priority) {
    if (remaining === 0n) break;
    shares[index] += 1n;
    remaining -= 1n;
  }
  return shares;
}
