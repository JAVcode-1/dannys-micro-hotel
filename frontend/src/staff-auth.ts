import { createClient } from "@supabase/supabase-js";
import {
  createDevelopmentAuth,
  developmentAuthAllowed,
} from "./development-auth";

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const guestAuth = url && key ? createClient(url, key) : null;

export const staffInviteCallback =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.hash.slice(1)).get("type") ===
    "invite" ||
    new URLSearchParams(window.location.search).get("type") === "invite");

export const apiBase = import.meta.env?.VITE_API_URL || "/api";
const localDevelopment = developmentAuthAllowed({
  development: import.meta.env?.DEV === true,
  enabled: true,
  hostname: typeof window === "undefined" ? "" : window.location.hostname,
});
export let isolatedDevelopment = false;
export let hallEnabled = false;
export let staffAuth = guestAuth;

// Bootstrap once, before rendering: a frontend flag cannot enable API workflows.
export async function initializeDevelopmentCapabilities() {
  if (!localDevelopment) return;
  try {
    const response = await fetch(`${apiBase}/guest/booking-status`, {
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return;
    const capabilities = await response.json();
    hallEnabled = capabilities.hallEnabled === true;
    if (capabilities.isolatedDevelopment !== true) {
      staffAuth = guestAuth;
      return capabilities;
    }
    if (
      capabilities.bookingEnabled !== true ||
      capabilities.hallEnabled !== true ||
      capabilities.unifiedEnabled !== true ||
      capabilities.paymentsEnabled !== true
    )
      return capabilities;
    staffAuth = createDevelopmentAuth(apiBase, window.sessionStorage);
    isolatedDevelopment = true;
    return capabilities;
  } catch {
    // Missing/unavailable isolated API leaves capabilities closed.
  }
}
