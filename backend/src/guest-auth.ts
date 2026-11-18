import { createClient } from "@supabase/supabase-js";

export type GuestIdentity = { id: string; email: string };

export async function verifyGuest(
  token: string,
): Promise<GuestIdentity | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured");
  const auth = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.getUser(token);
  const user = data.user;
  if (error || !user?.id || !user.email || !user.email_confirmed_at)
    return null;
  return { id: user.id, email: user.email.toLowerCase() };
}
