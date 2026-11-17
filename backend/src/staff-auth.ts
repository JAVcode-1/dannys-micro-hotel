import { createClient } from "@supabase/supabase-js";
import { databasePool } from "./database.js";

export type StaffIdentity = { id: string; email: string | null };

type AuthUser = { id: string; email?: string };
type StaffDependencies = {
  getUser(token: string): Promise<AuthUser | null>;
  query(sql: string, params: unknown[]): Promise<{ rowCount: number | null }>;
};

export function createStaffVerifier({ getUser, query }: StaffDependencies) {
  return async (token: string): Promise<StaffIdentity | null> => {
    const user = await getUser(token);
    if (!user) return null;
    const result = await query(
      "select auth_user_id from staytrack.staff_accounts where auth_user_id = $1 and active = true",
      [user.id],
    );
    if (result.rowCount !== 1) return null;
    return { id: user.id, email: user.email ?? null };
  };
}

export async function verifyStaff(
  token: string,
): Promise<StaffIdentity | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Supabase Auth is not configured");
  const auth = createClient(url, key, { auth: { persistSession: false } });
  return createStaffVerifier({
    getUser: async (accessToken) => {
      const { data, error } = await auth.auth.getUser(accessToken);
      return error ? null : data.user;
    },
    query: (sql, params) => databasePool().query(sql, params),
  })(token);
}

export async function auditStaffAccess(actorId: string): Promise<void> {
  await insertStaffAudit(actorId, (sql, params) =>
    databasePool().query(sql, params),
  );
}

export async function insertStaffAudit(
  actorId: string,
  query: StaffDependencies["query"],
): Promise<void> {
  await query(
    "insert into staytrack.staff_audit (actor_auth_user_id, action) values ($1, 'staff.session_verified')",
    [actorId],
  );
}
