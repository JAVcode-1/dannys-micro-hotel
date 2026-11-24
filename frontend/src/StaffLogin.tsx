import { useId, useRef, useState } from "react";
import SignInLayout from "./SignInLayout";
import StaffIcon from "./StaffIcon";
import { notifySuccess } from "./notifications";
import type { FormEvent } from "react";
import type { staffAuth } from "./staff-auth";
import { apiBase, isolatedDevelopment } from "./staff-auth";

export default function StaffLogin({
  authClient,
  passwordMode,
  onPasswordUpdated,
  sessionMessage,
  reviewsEnabled = false,
}: {
  authClient: NonNullable<typeof staffAuth>;
  passwordMode?: "invite" | "recovery";
  onPasswordUpdated: () => void;
  sessionMessage?: string;
  reviewsEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ identity: "", password: "" });
  const identityInput = useRef<HTMLInputElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const fieldId = useId();
  const identityError = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "Enter your staff username or email.";
    if (trimmed.includes("@") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed))
      return "Enter a valid email address.";
    return "";
  };

  function validate(setup = false) {
    const next = {
      identity: setup ? "" : identityError(email),
      password: !password
        ? "Enter your password."
        : setup && password.length < 12
          ? "Use at least 12 characters for your new password."
          : "",
    };
    setErrors(next);
    if (next.identity) identityInput.current?.focus();
    else if (next.password) passwordInput.current?.focus();
    return !next.identity && !next.password;
  }

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !validate()) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      let error;
      if (isolatedDevelopment || email.includes("@")) {
        ({ error } = await authClient.auth.signInWithPassword({ email: email.trim(), password }));
      } else {
        const response = await fetch(`${apiBase}/staff/sign-in`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: email.trim(), password }),
        });
        if (!response.ok) {
          setMessage(response.status === 401
            ? "Sign-in failed. Check your credentials or contact an administrator."
            : "Sign-in is unavailable. Please try again.");
          return;
        }
        const tokens = await response.json() as { access_token: string; refresh_token: string };
        ({ error } = await authClient.auth.setSession(tokens));
      }
      if (error)
        setMessage(
          "Sign-in failed. Check your credentials or contact an administrator.",
        );
    } catch {
      setMessage("Sign-in is unavailable. Please try again.");
    } finally {
      setBusy(false);
      pending.current = false;
      setPassword("");
    }
  }

  async function recover() {
    if (pending.current) return;
    if (!email.includes("@") || identityError(email)) {
      setErrors((current) => ({ ...current, identity: "Enter your account email to recover your password." }));
      identityInput.current?.focus();
      return;
    }
    pending.current = true;
    setRecovering(true);
    setBusy(true);
    setMessage("");
    setErrors((current) => ({ ...current, identity: "" }));
    try {
      const { error } = await authClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/staff`,
      });
      setMessage(
        error
          ? "Recovery is unavailable. Contact an administrator."
          : "If this email has an account, recovery instructions will arrive shortly.",
      );
      if (!error) notifySuccess("Password recovery requested. Check your email if an account exists.");
    } catch {
      setMessage("Recovery is unavailable. Contact an administrator.");
    } finally {
      setBusy(false);
      pending.current = false;
      setRecovering(false);
    }
  }

  async function updatePassword(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !validate(true)) return;
    pending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await authClient.auth.updateUser({ password });
      if (error)
        setMessage("Password update failed. Request a new recovery link.");
      else {
        notifySuccess("Password updated successfully.");
        onPasswordUpdated();
      }
    } catch {
      setMessage("Password update failed. Request a new recovery link.");
    } finally {
      setBusy(false);
      pending.current = false;
      setPassword("");
    }
  }

  return (
    <SignInLayout staff reviewsEnabled={reviewsEnabled}>
    <section className="staff-signin-content">
      <h1>
        {passwordMode ? "Set your password" : "Welcome back"}
      </h1>
      <p className="staff-signin-intro">
        {passwordMode
          ? "Choose a secure password for your staff account."
          : "Sign in to your hotel workspace."}
      </p>
      <form
        noValidate
        aria-busy={busy}
        onSubmit={(event) => void (passwordMode ? updatePassword(event) : signIn(event))}
      >
        {!passwordMode && (
          <div className="staff-signin-field" data-invalid={!!errors.identity}>
            <label htmlFor={`${fieldId}-identity`}>Username or email</label>
            <div className="staff-signin-input">
              <StaffIcon name="user" />
              <input
                ref={identityInput}
                id={`${fieldId}-identity`}
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                disabled={busy}
                placeholder="Your staff username or email"
                value={email}
                aria-invalid={!!errors.identity}
                aria-describedby={errors.identity ? `${fieldId}-identity-error` : undefined}
                onBlur={() => setErrors((current) => ({ ...current, identity: identityError(email) }))}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setErrors((current) => ({ ...current, identity: "" }));
                }}
              />
            </div>
            {errors.identity && <p id={`${fieldId}-identity-error`} className="staff-signin-field-error" role="alert">{errors.identity}</p>}
          </div>
        )}
        <div className="staff-signin-field" data-invalid={!!errors.password}>
          <div className="staff-signin-label-row">
            <label htmlFor={`${fieldId}-password`}>{passwordMode ? "New password" : "Password"}</label>
            {!passwordMode && (
              <button type="button" disabled={busy} className="staff-signin-recover" onClick={() => void recover()}>
                Forgot password?
              </button>
            )}
          </div>
          <div className="staff-signin-input">
            <StaffIcon name="lock" />
            <input
              ref={passwordInput}
              id={`${fieldId}-password`}
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={passwordMode ? "new-password" : "current-password"}
              minLength={passwordMode ? 12 : undefined}
              required
              disabled={busy}
              placeholder={passwordMode ? "At least 12 characters" : "Enter your password"}
              value={password}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? `${fieldId}-password-error` : undefined}
              onChange={(event) => {
                setPassword(event.target.value);
                setErrors((current) => ({ ...current, password: "" }));
              }}
            />
            <button
              type="button"
              className="staff-signin-eye"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            ><StaffIcon name={showPassword ? "eye-off" : "eye"} /></button>
          </div>
          {errors.password && <p id={`${fieldId}-password-error`} className="staff-signin-field-error" role="alert">{errors.password}</p>}
        </div>
        <button type="submit" disabled={busy} className="staff-signin-submit" data-busy={busy}>
          <span className="staff-signin-submit-label">
            <span aria-hidden={busy}>{passwordMode ? (passwordMode === "invite" ? "Set password" : "Update password") : "Sign in"}</span>
            <span aria-hidden={!busy}>{passwordMode ? "Saving password" : recovering ? "Sending recovery" : "Signing in"}</span>
          </span>
          <span className="sr-only" role="status">{busy ? (passwordMode ? "Saving password" : recovering ? "Sending recovery" : "Signing in") : ""}</span>
        </button>
        <p className="staff-signin-access">Need access? <strong>Contact your administrator.</strong></p>
      </form>
      {(message || sessionMessage) && (
        <p role="status" className="staff-signin-message">
          {message || sessionMessage}
        </p>
      )}
    </section>
    </SignInLayout>
  );
}
