import { createClient } from "@supabase/supabase-js";
import { databasePool } from "./database.js";
import { BookingError } from "./booking-quote.js";

// Hosted usernames are assigned through admin-only Auth app_metadata, never user_metadata.
export async function signInStaffUsername(value: unknown) {
  const input = value as { username?: unknown; password?: unknown } | null;
  if (
    !input ||
    typeof input.username !== "string" ||
    !/^[a-z0-9_-]{1,40}$/i.test(input.username.trim()) ||
    typeof input.password !== "string" ||
    !input.password ||
    input.password.length > 256
  )
    throw new BookingError("Invalid username or password.", 401);
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new BookingError("Staff sign-in is unavailable.", 503);
  const pool = databasePool();
  const { rows } = await pool.query<{ id: string; email: string }>(
    `select u.id,u.email from auth.users u join staytrack.staff_accounts s on s.auth_user_id=u.id
     where s.active and lower(u.raw_app_meta_data->>'staff_username')=$1 limit 2`,
    [input.username.trim().toLowerCase()],
  );
  if (rows.length !== 1)
    throw new BookingError("Invalid username or password.", 401);
  const auth = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const { data, error } = await auth.auth.signInWithPassword({
    email: rows[0].email,
    password: input.password,
  });
  if (error || !data.session || data.user?.id !== rows[0].id)
    throw new BookingError("Invalid username or password.", 401);
  const audit = await pool.query(
    `insert into staytrack.staff_audit(actor_auth_user_id,action)
     select auth_user_id,'staff.username_sign_in' from staytrack.staff_accounts
     where auth_user_id=$1 and active returning id`,
    [data.user.id],
  );
  if (!audit.rowCount) {
    await auth.auth.signOut({ scope: "local" });
    throw new BookingError("Invalid username or password.", 401);
  }
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  };
}
