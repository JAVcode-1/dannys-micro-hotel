import { toast } from "sonner";

const navigationToastKey = "staytrack:success-toast";

export function notifySuccess(message: string, afterNavigation = false) {
  if (afterNavigation) {
    try {
      sessionStorage.setItem(
        navigationToastKey,
        JSON.stringify({ message, expiresAt: Date.now() + 30000 }),
      );
      return;
    } catch {
      // Storage restrictions must not interrupt a successful action.
    }
  }
  toast.success(message);
}

export function restoreSuccessToast() {
  try {
    const saved = sessionStorage.getItem(navigationToastKey);
    sessionStorage.removeItem(navigationToastKey);
    if (!saved) return;
    const pending = JSON.parse(saved) as {
      message?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof pending.message === "string" &&
      typeof pending.expiresAt === "number" &&
      pending.expiresAt > Date.now()
    )
      toast.success(pending.message);
  } catch {
    // Notifications are optional when browser storage is unavailable.
  }
}
