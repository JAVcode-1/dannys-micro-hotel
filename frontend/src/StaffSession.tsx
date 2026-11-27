import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiBase, staffAuth } from "./staff-auth";
import { notifySuccess } from "./notifications";
import PrivateDataScope from "./PrivateDataScope";

type StaffAccess =
  | { status: "loading" }
  | { status: "authenticated"; token: string; identity: string }
  | { status: "unauthenticated"; message?: string };

type Verification =
  { token: string; identity: string } | { token: string; message: string };

const restoreError = "Unable to restore your session. Please sign in again.";
const expiredMessage = "Your staff session expired. Please sign in again.";

const StaffSessionContext = createContext<{
  access: StaffAccess;
  restored: boolean;
  hasSession: boolean;
  recovering: boolean;
  finishRecovery: () => void;
} | null>(null);

export function useStaffSession() {
  const context = useContext(StaffSessionContext);
  if (!context) throw new Error("StaffSessionProvider is required.");
  return context;
}

export function StaffSessionProvider({
  authClient = staffAuth,
  children,
}: {
  authClient?: typeof staffAuth;
  children: ReactNode;
}) {
  const [session, setSession] = useState<Session | null | undefined>();
  const [restored, setRestored] = useState(false);
  const [restorationMessage, setRestorationMessage] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [verification, setVerification] = useState<Verification>();
  const currentSession = useRef<Session | null | undefined>(undefined);
  const signInPending = useRef(false);
  const token = session?.access_token;
  const expiresAt = session?.expires_at;

  useEffect(() => {
    if (!authClient) return;
    let active = true;
    let eventSeen = false;
    // A late restoration snapshot must never override a live sign-in or sign-out.
    const { data } = authClient.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === "INITIAL_SESSION" && eventSeen) return;
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_OUT" && !next)
        return;
      if (
        event === "SIGNED_IN" &&
        next &&
        currentSession.current?.user.id !== next.user.id
      )
        signInPending.current = true;
      if (!next) signInPending.current = false;
      currentSession.current = next;
      eventSeen = true;
      setRestorationMessage("");
      setSession((current) =>
        current && next && current.access_token === next.access_token
          ? current
          : next,
      );
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      else if (!next) setRecovering(false);
    });

    function finishRestore(next: Session | null, failed = false) {
      if (!active) return;
      if (!eventSeen) {
        eventSeen = !failed;
        currentSession.current = next;
        setSession(next);
        setRestorationMessage(failed ? restoreError : "");
      }
      setRestored(true);
    }

    void authClient.auth.getSession().then(
      ({ data, error }) => finishRestore(data.session, !!error),
      () => finishRestore(null, true),
    );
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [authClient]);

  useEffect(() => {
    if (!token) {
      setVerification(undefined);
      return;
    }
    const controller = new AbortController();
    const remaining =
      expiresAt === undefined ? undefined : expiresAt * 1000 - Date.now();
    const expire = () => {
      controller.abort();
      setVerification({ token, message: expiredMessage });
    };
    if (remaining !== undefined && remaining <= 0) {
      expire();
      return;
    }
    const timer =
      remaining === undefined
        ? undefined
        : window.setTimeout(expire, remaining);

    void fetch(`${apiBase}/staff/me`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? expiredMessage
              : "Staff access is unavailable or denied.",
          );
        const staff = (await response.json()) as {
          email: string | null;
          username?: string;
        };
        if (!controller.signal.aborted) {
          setVerification({
            token,
            identity: staff.username ?? staff.email ?? "Staff member",
          });
          if (signInPending.current) {
            signInPending.current = false;
            notifySuccess("Signed in successfully.");
          }
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setVerification({
            token,
            message:
              error instanceof Error
                ? error.message
                : "Unable to verify staff access.",
          });
      });
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [token, expiresAt]);

  let access: StaffAccess = { status: "loading" };
  if (session === null)
    access = { status: "unauthenticated", message: restorationMessage };
  else if (verification && verification.token === token)
    access =
      "identity" in verification
        ? {
            status: "authenticated",
            token: verification.token,
            identity: verification.identity,
          }
        : { status: "unauthenticated", message: verification.message };

  return (
    <StaffSessionContext.Provider
      value={{
        access,
        restored,
        hasSession:
          !!session &&
          (expiresAt === undefined || expiresAt * 1000 > Date.now()),
        recovering,
        finishRecovery: () => setRecovering(false),
      }}
    >
      <PrivateDataScope
        role="staff"
        userId={
          access.status === "unauthenticated" ? undefined : session?.user.id
        }
      >
        {children}
      </PrivateDataScope>
    </StaffSessionContext.Provider>
  );
}
