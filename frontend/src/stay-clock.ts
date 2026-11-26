export type ClockAnchor = { serverMs: number; receivedMs: number };
export const serverTime = (anchor: ClockAnchor, now = performance.now()) =>
  anchor.serverMs + now - anchor.receivedMs;
export function countdown(
  checkout: number,
  now: number,
  reminderMinutes: number | null,
) {
  const remainingMs = checkout - now;
  const warningMinutes =
    remainingMs > 0 &&
    reminderMinutes !== null &&
    remainingMs <= reminderMinutes * 60000
      ? reminderMinutes
      : undefined;
  return {
    remainingMs,
    state:
      remainingMs <= 0
        ? "overdue"
        : warningMinutes === undefined
          ? "active"
          : "warning",
    warningMinutes,
  };
}
