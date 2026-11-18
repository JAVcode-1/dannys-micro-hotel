import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { apiBase, staffAuth, staffInviteCallback } from "./staff-auth";
import StaffCatalog from "./StaffCatalog";
import StaffRooms from "./StaffRooms";
import OperationalSettings from "./OperationalSettings";
import StaffPaymentReviews from "./StaffPaymentReviews";

export default function StaffLogin({
  authClient = staffAuth,
  apiUrl = apiBase,
}: {
  authClient?: typeof staffAuth;
  apiUrl?: string;
} = {}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [invited, setInvited] = useState(
    () =>
      staffInviteCallback ||
      new URLSearchParams(window.location.hash.slice(1)).get("type") ===
        "invite" ||
      new URLSearchParams(window.location.search).get("type") === "invite",
  );

  useEffect(() => {
    if (!authClient) return;
    const client = authClient;
    let eventSeen = false;
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (event === "INITIAL_SESSION" || event === "SIGNED_OUT" || next)
        eventSeen = true;
      setIdentity(null);
      setSession(next);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      else if (event === "SIGNED_OUT" || !next) setRecovering(false);
    });
    void client.auth.getSession().then(
      ({ data }) => {
        if (!eventSeen) setSession(data.session);
        if (invited) window.history.replaceState(null, "", "/staff");
      },
      () => {
        if (invited) window.history.replaceState(null, "", "/staff");
        if (!eventSeen)
          setMessage("Unable to restore your session. Please sign in again.");
      },
    );
    return () => data.subscription.unsubscribe();
  }, [authClient, invited]);

  useEffect(() => {
    if (!session) {
      setIdentity(null);
      return;
    }
    const controller = new AbortController();
    void fetch(`${apiUrl}/staff/me`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Staff access is unavailable or denied.");
        const staff = (await response.json()) as { email: string | null };
        if (controller.signal.aborted) return;
        setIdentity(staff.email ?? "Staff member");
        setMessage("");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setIdentity(null);
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to verify staff access.",
        );
      });
    return () => controller.abort();
  }, [session, apiUrl]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await authClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error)
        setMessage(
          "Sign-in failed. Check your credentials or contact an administrator.",
        );
    } catch {
      setMessage("Sign-in is unavailable. Please try again.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function recover() {
    if (!authClient || !email) return;
    setBusy(true);
    try {
      const { error } = await authClient.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/staff`,
      });
      setMessage(
        error
          ? "Recovery is unavailable. Contact an administrator."
          : "If this email has an account, recovery instructions will arrive shortly.",
      );
    } catch {
      setMessage("Recovery is unavailable. Contact an administrator.");
    } finally {
      setBusy(false);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (!authClient) return;
    setBusy(true);
    try {
      const { error } = await authClient.auth.updateUser({ password });
      if (error)
        setMessage("Password update failed. Request a new recovery link.");
      else if (invited) {
        setInvited(false);
        setMessage("Password set. Staff access requires activation.");
      } else {
        setRecovering(false);
        setMessage("Password updated.");
      }
    } catch {
      setMessage("Password update failed. Request a new recovery link.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  async function signOut() {
    if (!authClient) return;
    try {
      const { error } = await authClient.auth.signOut();
      if (error) setMessage("Sign-out failed. Please try again.");
    } catch {
      setMessage("Sign-out failed. Please try again.");
    }
  }

  const client = authClient;
  if (!client)
    return (
      <p className="text-muted">
        Staff sign-in is not configured for this preview.
      </p>
    );
  return (
    <section
      className={`mx-auto rounded-2xl border border-subtle bg-white p-7 shadow-sm ${identity && ["/staff/rooms", "/staff/settings", "/staff/payments"].includes(window.location.pathname) ? "max-w-5xl" : "max-w-md"}`}
    >
      <h1 className="text-2xl font-bold text-main">Staff sign-in</h1>
      <p className="mt-2 text-sm text-muted">
        Use your individual employee account.
      </p>
      {recovering || (invited && session) ? (
        <form
          onSubmit={(event) => void updatePassword(event)}
          className="mt-6 space-y-4"
        >
          <label className="block text-sm font-medium">
            New password
            <input
              className="mt-1 w-full rounded-lg border border-subtle p-3"
              type="password"
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-primary p-3 font-semibold text-white disabled:opacity-50"
          >
            {invited ? "Set password" : "Update password"}
          </button>
        </form>
      ) : identity ? (
        <div className="mt-6">
          <p>Signed in as {identity}</p>
          <nav className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
            <a
              className="rounded-lg bg-selected px-3 py-2 text-primary"
              href="/staff/payments"
            >
              Payments
            </a>
            <a
              className="rounded-lg bg-selected px-3 py-2 text-primary"
              href="/staff"
            >
              Catalog
            </a>
            <a
              className="rounded-lg bg-selected px-3 py-2 text-primary"
              href="/staff/rooms"
            >
              Rooms
            </a>
            <a
              className="rounded-lg bg-selected px-3 py-2 text-primary"
              href="/staff/settings"
            >
              Settings
            </a>
          </nav>
          {session &&
            (window.location.pathname === "/staff/rooms" ? (
              <StaffRooms token={session.access_token} />
            ) : window.location.pathname === "/staff/settings" ? (
              <OperationalSettings token={session.access_token} />
            ) : window.location.pathname === "/staff/payments" ? (
              <StaffPaymentReviews token={session.access_token} />
            ) : (
              <StaffCatalog token={session.access_token} />
            ))}
          <button
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-white"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => void signIn(event)}
          className="mt-6 space-y-4"
        >
          <label className="block text-sm font-medium">
            Email
            <input
              className="mt-1 w-full rounded-lg border border-subtle p-3"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              className="mt-1 w-full rounded-lg border border-subtle p-3"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button
            disabled={busy}
            className="w-full rounded-lg bg-primary p-3 font-semibold text-white disabled:opacity-50"
          >
            Sign in
          </button>
          <button
            type="button"
            disabled={busy || !email}
            onClick={() => void recover()}
            className="text-sm font-medium text-primary disabled:opacity-50"
          >
            Forgot password?
          </button>
        </form>
      )}
      {message && (
        <p role="status" className="mt-4 text-sm text-muted">
          {message}
        </p>
      )}
    </section>
  );
}
