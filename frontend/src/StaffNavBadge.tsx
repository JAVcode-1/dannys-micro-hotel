export type StaffNavCounts = Readonly<Record<string, number | undefined>>;

const queueDescriptions: Readonly<Record<string, string>> = {
  "/staff/reservations": "bookings awaiting payment review",
  "/staff/check-ins": "due for check-in today",
  "/staff/payments": "payment proofs to review",
  "/staff/stays": "stays past checkout",
  "/staff/rooms": "rooms needing cleaning or a readiness check",
  "/staff/hall": "confirmed events today",
};

export function staffNavTotal(
  entries: readonly { path: string }[],
  counts: StaffNavCounts,
) {
  const hasPayments = entries.some(({ path }) => path === "/staff/payments");
  return entries.reduce((sum, { path }) => {
    // Reservations and Payments both point to the same submitted-proof queue.
    if (hasPayments && path === "/staff/reservations") return sum;
    return sum + (counts[path] ?? 0);
  }, 0);
}

export default function StaffNavBadge({
  count = 0,
  path,
}: {
  count?: number;
  path?: string;
}) {
  if (count === 0) return null;
  const description =
    (path ? queueDescriptions[path] : undefined) ?? "to check";

  return (
    <span className="staff-nav-badge" title={`${count} ${description}`}>
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">
        , {count} {description}
      </span>
    </span>
  );
}
