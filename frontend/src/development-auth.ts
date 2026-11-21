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
    });
    if (!response.ok)
      throw new Error("The isolated development API is unavailable.");
    const candidate = (await response.json()) as Session;
    if (
      !candidate.access_token ||
      candidate.user?.email !== `${kind}@example.test`
    )
      throw new Error("Invalid isolated development identity.");
    return candidate;
  }
  function emit(event: AuthChangeEvent, next: Session | null) {
    changed = true;
    session = next;
    for (const listener of listeners) listener(event, next);
  }
  async function login(kind: "guest" | "staff") {
    const next = await load(kind);
    storage.setItem(key, kind);
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
    }) =>
      email.trim().toLowerCase() === "staff@example.test" &&
      password === "development-only"
        ? login("staff")
        : failure(),
    signOut: async () => {
      storage.removeItem(key);
      emit("SIGNED_OUT", null);
      return { error: null };
    },
    resetPasswordForEmail: async () => failure(),
    updateUser: async () => failure(),
  };
  return { auth } as unknown as SupabaseClient;
}
