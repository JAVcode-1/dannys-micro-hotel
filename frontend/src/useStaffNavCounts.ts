import { useEffect, useState } from "react";
import { apiBase } from "./staff-auth";
import type { StaffNavCounts } from "./StaffNavBadge";

const queueCounts = {
  "/staff/check-ins": "arrivals",
  "/staff/payments": "paymentReviews",
  "/staff/stays": "overdue",
  "/staff/rooms": "needsCleaning",
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

  useEffect(() => {
    let controller: AbortController | undefined;

    async function refresh() {
      if (document.hidden) return;
      controller?.abort();
      controller = new AbortController();
      const { signal } = controller;
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
          const value = data[key];
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
    }

    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [token, pathname]);

  return summary?.token === token ? summary.counts : {};
}
