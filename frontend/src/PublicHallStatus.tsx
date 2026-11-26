import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";

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
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    let controller: AbortController | undefined;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
      try {
        const response = await fetch(`${apiBase}/guest/hall-status`, {
          cache: "no-store",
          signal,
        });
        if (!response.ok) throw new Error("Hall status unavailable.");
        const data = (await response.json()) as { status?: string };
        if (!signal.aborted)
          setStatus(
            typeof data.status === "string" &&
              Object.hasOwn(statuses, data.status)
              ? (data.status as Status)
              : "unknown",
          );
      } catch {
        if (!signal.aborted) setStatus("unknown");
      }
    }
    const refreshWhenVisible = () => {
      if (!document.hidden) void refresh();
    };
    void refresh();
    const timer = setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      controller?.abort();
    };
  }, []);

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
