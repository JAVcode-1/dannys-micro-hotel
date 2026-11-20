import { useState } from "react";
import type { FormEvent } from "react";
import type { staffAuth } from "./staff-auth";

export default function StaffLogin({
  authClient,
  passwordMode,
  onPasswordUpdated,
  sessionMessage,
}: {
  authClient: NonNullable<typeof staffAuth>;
  passwordMode?: "invite" | "recovery";
  onPasswordUpdated: () => void;
  sessionMessage?: string;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent) {
    event.preventDefault();
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
    if (!email) return;
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
    setBusy(true);
    try {
      const { error } = await authClient.auth.updateUser({ password });
      if (error)
        setMessage("Password update failed. Request a new recovery link.");
      else onPasswordUpdated();
    } catch {
      setMessage("Password update failed. Request a new recovery link.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-subtle bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-main">
        {passwordMode ? "Staff password setup" : "Staff sign-in"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        Use your individual employee account.
      </p>
      {passwordMode ? (
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
            {passwordMode === "invite" ? "Set password" : "Update password"}
          </button>
        </form>
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
      {(message || sessionMessage) && (
        <p role="status" className="mt-4 text-sm text-muted">
          {message || sessionMessage}
        </p>
      )}
    </section>
  );
}
