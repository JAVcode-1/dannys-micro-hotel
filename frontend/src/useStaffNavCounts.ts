import { useCallback, useEffect, useRef, useState } from "react";
import { apiBase } from "./staff-auth";
import type { StaffNavCounts } from "./StaffNavBadge";

const queueCounts = {
  "/staff/reservations": "paymentReviews",
  "/staff/check-ins": "arrivals",
  "/staff/payments": "paymentReviews",
  "/staff/stays": "overdue",
  "/staff/rooms": "roomAttention",
  "/staff/hall": "hallArrivals",
};

export default function useStaffNavCounts(
  token: string,
  pathname: string,
): StaffNavCounts {
  const [summary, setSummary] = useState<{
    token: string;
    counts: StaffNavCounts;
  }>();
  const request = useRef<AbortController | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (document.hidden) return;
    request.current?.abort();
    request.current = new AbortController();
    const { signal } = request.current;
    try {
      const response = await fetch(`${apiBase}/staff/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw new Error("Staff counts unavailable.");
      const data = (await response.json()) as Record<string, unknown>;
      const counts: Record<string, number> = {};
      for (const [path, key] of Object.entries(queueCounts)) {
        const value =
          data[key] ??
          (key === "roomAttention" ? data.needsCleaning : undefined);
        if (
          typeof value === "number" &&
          Number.isSafeInteger(value) &&
          value > 0
        )
          counts[path] = value;
      }
      if (!signal.aborted) setSummary({ token, counts });
    } catch {
      if (!signal.aborted) setSummary(undefined);
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    return () => request.current?.abort();
  }, [pathname, refresh]);

  useEffect(() => {
    const connection = new AbortController();
    let reconnect: number | undefined;

    async function listen() {
      try {
        const response = await fetch(`${apiBase}/staff/dashboard/events`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: connection.signal,
        });
        if (response.status === 401 || response.status === 403) return;
        if (
          response.ok &&
          response.body &&
          response.headers.get("content-type")?.startsWith("text/event-stream")
        ) {
          const reader = response.body
            .pipeThrough(new TextDecoderStream())
            .getReader();
          let partial = "";
          for (;;) {
            const { done, value } = await reader.read();
            if (done || connection.signal.aborted) break;
            const lines = (partial + value).split("\n");
            partial = lines.pop() ?? "";
            if (lines.includes("data: refresh")) void refresh();
          }
        }
      } catch {
        // The regular refreshes continue while the API reconnects.
      }
      if (!connection.signal.aborted)
        reconnect = window.setTimeout(() => void listen(), 5_000);
    }

    void listen();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      connection.abort();
      window.clearTimeout(reconnect);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token, refresh]);

  return summary?.token === token ? summary.counts : {};
}
