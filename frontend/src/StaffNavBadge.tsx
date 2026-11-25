export type StaffNavCounts = Readonly<Record<string, number | undefined>>;

const queueDescriptions: Readonly<Record<string, string>> = {
  "/staff/check-ins": "due for check-in today",
  "/staff/payments": "payment proofs to review",
  "/staff/stays": "stays past checkout",
  "/staff/rooms": "rooms awaiting cleaning",
  "/staff/hall": "confirmed events today",
};

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
