import { useApiQuery } from "./api-query";
import type { StaffNavCounts } from "./StaffNavBadge";

const queueCounts = {
  "/staff/reservations": "paymentReviews",
  "/staff/check-ins": "arrivals",
  "/staff/payments": "paymentReviews",
  "/staff/stays": "overdue",
  "/staff/rooms": "roomAttention",
  "/staff/hall": "hallArrivals",
};

export default function useStaffNavCounts(token: string): StaffNavCounts {
  const { data } = useApiQuery<Record<string, number>>(
    "/staff/dashboard",
    token,
    { live: true, clock: true },
  );
  const counts: Record<string, number> = {};
  for (const [path, key] of Object.entries(queueCounts)) {
    const value =
      data?.[key] ??
      (key === "roomAttention" ? data?.needsCleaning : undefined);
    if (typeof value === "number" && Number.isSafeInteger(value) && value > 0)
      counts[path] = value;
  }
  return counts;
}
