import { useApiQuery } from "./api-query";

const statuses = {
  available: {
    label: "Ready and available now",
    color: "bg-green-100 text-green-800",
  },
  in_use: { label: "Occupied now", color: "bg-amber-100 text-amber-900" },
  reserved: { label: "Reserved now", color: "bg-amber-100 text-amber-900" },
  not_ready: {
    label: "Temporarily unavailable",
    color: "bg-red-100 text-red-800",
  },
  unknown: {
    label: "Current status unavailable",
    color: "bg-white text-muted",
  },
  loading: { label: "Checking current status…", color: "bg-white text-muted" },
};

type Status = keyof typeof statuses;

export default function PublicHallStatus() {
  const hall = useApiQuery<{ status?: string }>(
    "/guest/hall-status",
    undefined,
    { live: true },
  );
  const value = hall.data?.status;
  const status: Status = hall.isPending
    ? "loading"
    : hall.isError || !value || !Object.hasOwn(statuses, value)
      ? "unknown"
      : (value as Status);

  return (
    <div className="rounded-xl border border-subtle bg-selected px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">Function Hall status</span>
        <span
          role="status"
          className={`rounded-full px-3 py-1 font-semibold ${statuses[status].color}`}
        >
          {statuses[status].label}
        </span>
      </div>
      <div className="mt-1 text-muted">
        Availability depends on your event date and time.
      </div>
    </div>
  );
}
