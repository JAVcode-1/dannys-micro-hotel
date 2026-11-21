import { createClient } from "@supabase/supabase-js";
import {
  createDevelopmentAuth,
  developmentAuthAllowed,
} from "./development-auth";

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const staffInviteCallback =
  typeof window !== "undefined" &&
  (new URLSearchParams(window.location.hash.slice(1)).get("type") ===
    "invite" ||
    new URLSearchParams(window.location.search).get("type") === "invite");

export const apiBase = import.meta.env?.VITE_API_URL || "/api";
export const isolatedDevelopment = developmentAuthAllowed({
  development: import.meta.env?.DEV === true,
  enabled: import.meta.env?.VITE_ISOLATED_DEVELOPMENT === "true",
  hostname: typeof window === "undefined" ? "" : window.location.hostname,
});
export const staffAuth = isolatedDevelopment
  ? createDevelopmentAuth(apiBase, window.sessionStorage)
  : url && key
    ? createClient(url, key)
    : null;
