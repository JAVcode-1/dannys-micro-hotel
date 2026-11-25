import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";

const labels = {
  available: "Check availability for your event date",
  in_use: "Event in progress",
  reserved: "Currently reserved",
  not_ready: "Temporarily unavailable",
  unknown: "Current status unavailable",
  loading: "Checking current status…",
};

type Status = keyof typeof labels;

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
          signal,
        });
        if (!response.ok) throw new Error("Hall status unavailable.");
        const data = (await response.json()) as { status?: string };
        if (!signal.aborted)
          setStatus(
            typeof data.status === "string" &&
              Object.hasOwn(labels, data.status)
              ? (data.status as Status)
              : "unknown",
          );
      } catch {
        if (!signal.aborted) setStatus("unknown");
      }
    }
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30_000);
    return () => {
      clearInterval(timer);
      controller?.abort();
    };
  }, []);

  return (
    <div className="rounded-xl border border-subtle bg-selected px-4 py-3 text-sm">
      <div role="status">
        {status === "available" ? (
          <span className="font-semibold">{labels.available}</span>
        ) : (
          <>
            <span className="font-semibold">Function Hall status</span> ·{" "}
            {labels[status]}
          </>
        )}
      </div>
      <div className="mt-1 text-muted">
        Availability depends on your event date and time.
      </div>
    </div>
  );
}
