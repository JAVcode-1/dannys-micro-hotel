import { createClient } from "@supabase/supabase-js";

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;

export const staffAuth = url && key ? createClient(url, key) : null;
export const apiBase = import.meta.env?.VITE_API_URL || "/api";
