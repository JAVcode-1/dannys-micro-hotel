export type ClockAnchor = { serverMs: number; receivedMs: number };
export const serverTime = (anchor: ClockAnchor, now = performance.now()) =>
  anchor.serverMs + now - anchor.receivedMs;
export function countdown(checkout: number, now: number, warnings: number[]) {
  const remainingMs = checkout - now;
  const warningMinutes = warnings
    .filter((m) => remainingMs <= m * 60000)
    .sort((a, b) => a - b)[0];
  return {
    remainingMs,
    state:
      remainingMs <= 0
        ? "overdue"
        : warningMinutes === undefined
          ? "active"
          : "warning",
    warningMinutes: remainingMs <= 0 ? undefined : warningMinutes,
  };
}
