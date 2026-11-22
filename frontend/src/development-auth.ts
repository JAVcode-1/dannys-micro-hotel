import type {
  AuthChangeEvent,
  Session,
  SupabaseClient,
} from "@supabase/supabase-js";

export function developmentAuthAllowed({
  development,
  enabled,
  hostname,
}: {
  development: boolean;
  enabled: boolean;
  hostname: string;
}) {
  return (
    development &&
    enabled &&
    ["localhost", "127.0.0.1", "[::1]"].includes(hostname)
  );
}
// Synthetic identities only. The isolated API issues ephemeral local tokens; no provider is contacted.
export function createDevelopmentAuth(
  base: string,
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  request: typeof fetch = fetch,
): SupabaseClient {
  const destination = new URL(base, "http://localhost");
  if (
    destination.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(destination.hostname)
  )
    throw new Error("Fixture Auth requires a loopback API.");
  const key = "staytrack.isolated.identity";
  const staffTokenKey = "staytrack.isolated.staff-token";
  const listeners = new Set<
    (event: AuthChangeEvent, session: Session | null) => void
  >();
  let session: Session | null = null;
  let changed = false;
  let restoration: Promise<Session | null> | undefined;
  const failure = () => ({
    data: { session: null, user: null },
    error: new Error(
      "Use only the documented synthetic development identity and credentials.",
    ),
  });
  async function load(kind: "guest" | "staff") {
    const response = await request(`${base}/development/session?kind=${kind}`, {
      cache: "no-store",
      headers: kind === "staff"
        ? { Authorization: `Bearer ${storage.getItem(staffTokenKey) ?? ""}` }
        : {},
    });
    if (!response.ok)
      throw new Error("The isolated development API is unavailable.");
    const candidate = (await response.json()) as Session;
    if (
      !candidate.access_token ||
      !candidate.user?.id ||
      (kind === "guest" && candidate.user.email !== "guest@example.test") ||
      (kind === "staff" && !candidate.user.email?.endsWith("@example.test"))
    )
      throw new Error("Invalid isolated development identity.");
    return candidate;
  }
  function emit(event: AuthChangeEvent, next: Session | null) {
    changed = true;
    session = next;
    for (const listener of listeners) listener(event, next);
  }
  async function login(kind: "guest" | "staff", issued?: Session) {
    const next = issued ?? await load(kind);
    if (kind === "staff") storage.setItem(staffTokenKey, next.access_token);
    storage.setItem(key, kind);
    restoration = Promise.resolve(next);
    emit("SIGNED_IN", next);
    return { data: { session: next, user: next.user }, error: null };
  }
  const auth = {
    getSession: async () => {
      if (!restoration)
        restoration = (async () => {
          const kind = storage.getItem(key);
          const next =
            kind === "guest" || kind === "staff" ? await load(kind) : null;
          if (!changed) session = next;
          return session;
        })();
      try {
        await restoration;
        return { data: { session }, error: null };
      } catch {
        return {
          data: { session: null },
          error: new Error("Isolated session restoration failed."),
        };
      }
    },
    onAuthStateChange: (
      listener: (event: AuthChangeEvent, value: Session | null) => void,
    ) => {
      listeners.add(listener);
      return {
        data: {
          subscription: { unsubscribe: () => listeners.delete(listener) },
        },
      };
    },
    signInWithOtp: async ({ email }: { email: string }) =>
      email.trim().toLowerCase() === "guest@example.test"
        ? { error: null }
        : failure(),
    verifyOtp: async ({ email, token }: { email: string; token: string }) =>
      email.trim().toLowerCase() === "guest@example.test" && token === "123456"
        ? login("guest")
        : failure(),
    signInWithPassword: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const response = await request(`${base}/development/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: email, password }),
      });
      if (!response.ok) return failure();
      const issued = await response.json() as Session;
      if (!issued.access_token || !issued.user?.id || !issued.user.email?.endsWith("@example.test"))
        return failure();
      return login("staff", issued);
    },
    signOut: async () => {
      storage.removeItem(key);
      storage.removeItem(staffTokenKey);
      restoration = Promise.resolve(null);
      emit("SIGNED_OUT", null);
      return { error: null };
    },
    resetPasswordForEmail: async () => failure(),
    updateUser: async () => failure(),
  };
  return { auth } as unknown as SupabaseClient;
}
