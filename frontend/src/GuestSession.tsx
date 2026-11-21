import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiBase, staffAuth } from "./staff-auth";

type GuestAccess =
  | { status: "loading" }
  | { status: "unauthenticated"; message?: string }
  | { status: "authenticated"; token: string; email: string; id: string };
const GuestContext = createContext<{
  access: GuestAccess;
  signOut(): Promise<void>;
} | null>(null);

export function safeGuestReturnTo(value: string | null) {
  if (
    !value ||
    value.includes("\\") ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32)
  )
    return "/reservations";
  return /^\/(?:book|reservations(?:\/[0-9a-f-]{36}(?:\/payment)?)?)(?:\?[^#]*)?$/i.test(
    value,
  )
    ? value
    : "/reservations";
}
export function useGuestSession() {
  return useContext(GuestContext);
}

export function GuestSessionProvider({
  authClient = staffAuth,
  children,
}: {
  authClient?: typeof staffAuth;
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null | undefined>(
    authClient ? undefined : null,
  );
  const [verified, setVerified] = useState<GuestAccess & { token?: string }>({
    status: "loading",
  });
  useEffect(() => {
    if (!authClient) return;
    let active = true;
    let changed = false;
    const { data } = authClient.auth.onAuthStateChange((event, next) => {
      if (!active || (event === "INITIAL_SESSION" && changed)) return;
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_OUT" && !next)
        return;
      changed = true;
      setSession(next);
    });
    void authClient.auth.getSession().then(
      ({ data, error }) => {
        if (active && !changed) setSession(error ? null : data.session);
      },
      () => {
        if (active && !changed) setSession(null);
      },
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authClient]);
  const token = session?.access_token;
  const expiresAt = session?.expires_at;
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const expired = () => {
      controller.abort();
      setVerified({
        status: "unauthenticated",
        token,
        message: "Your session expired. Verify your email again.",
      });
    };
    const remaining =
      expiresAt === undefined ? undefined : expiresAt * 1000 - Date.now();
    if (remaining !== undefined && remaining <= 0) {
      expired();
      return;
    }
    const timer =
      remaining === undefined
        ? undefined
        : window.setTimeout(expired, remaining);
    void fetch(`${apiBase}/guest/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Guest verification is unavailable. Verify your email again.",
          );
        const identity = (await response.json()) as {
          id: string;
          email: string;
        };
        if (!identity.id || !identity.email)
          throw new Error("Verified guest identity is unavailable.");
        if (!controller.signal.aborted)
          setVerified({ status: "authenticated", token, ...identity });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setVerified({
            status: "unauthenticated",
            token,
            message:
              error instanceof Error
                ? error.message
                : "Guest access unavailable.",
          });
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [token, expiresAt]);
  const access: GuestAccess =
    session === null
      ? { status: "unauthenticated" }
      : token && verified.token === token
        ? verified
        : { status: "loading" };
  return (
    <GuestContext.Provider
      value={{
        access,
        signOut: async () => {
          if (!authClient) return;
          const { error } = await authClient.auth.signOut();
          if (error) throw error;
          setSession(null);
        },
      }}
    >
      {children}
    </GuestContext.Provider>
  );
}
