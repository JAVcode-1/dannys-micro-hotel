import { useState } from "react";
import { notifySuccess } from "./notifications";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiBase, guestAuth } from "./staff-auth";
import GuestReservations from "./GuestReservations";
import { safeGuestReturnTo, useGuestSession } from "./GuestSession";

export default function GuestAccess({
  authClient = guestAuth,
  reviewsEnabled = false,
}: {
  authClient?: SupabaseClient | null;
  reviewsEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "verified">("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const session = useGuestSession();
  const verified =
    session?.access.status === "authenticated" || step === "verified";
  const returnTo =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("returnTo");

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await authClient.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      notifySuccess("Verification code requested. Check your email.");
      setStep("code");
      setMessage(
        "If the address can receive mail, a six-digit code will arrive shortly.",
      );
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? error.code
        : undefined;
      setMessage(
        code === "email_address_not_authorized"
          ? "Email delivery is not configured for customer addresses. Please contact the hotel."
          : code === "over_email_send_rate_limit" || code === "over_request_rate_limit"
            ? "Too many code requests. Please wait before trying again."
            : "We could not send a code right now. Please try again shortly.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!authClient) return;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await authClient.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "email",
      });
      if (
        error ||
        !data.session ||
        !data.user?.email ||
        data.user.email.toLowerCase() !== email.trim().toLowerCase()
      ) {
        setMessage("The code is invalid or expired. Check it and try again.");
        return;
      }
      const response = await fetch(`${apiBase}/guest/me`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      if (!response.ok) {
        setMessage(
          "Email verification could not be confirmed. Please try again.",
        );
        return;
      }
      setCode("");
      setToken(data.session.access_token);
      setStep("verified");
      setMessage(
        "Email verified. Reservation lookup uses your verified identity.",
      );
      notifySuccess("Email verified. Signed in successfully.", Boolean(returnTo));
      if (returnTo) window.location.assign(safeGuestReturnTo(returnTo));
    } catch {
      setMessage("Verification is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="guest-access mx-auto max-w-lg rounded-3xl border border-subtle bg-white p-7 shadow-sm sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
        Guest access
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-main">
        Your stay, kept private.
      </h1>
      <p className="mt-3 text-muted">
        Verify your email to continue your booking or access your private
        reservations.
      </p>
      {!authClient ? (
        <p className="mt-8 text-muted">
          Email verification is unavailable because authentication is not configured. Please contact the hotel.
        </p>
      ) : verified ? (
        <p className="mt-8 rounded-xl bg-selected p-4 text-primary">
          Email verified.
        </p>
      ) : (
        <form
          onSubmit={(event) =>
            void (step === "email" ? send(event) : verify(event))
          }
          className="mt-8 space-y-5"
        >
          {step === "email" ? (
            <label className="block font-medium">
              Email address
              <input
                className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-4 text-base focus:outline-2 focus:outline-primary"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
          ) : (
            <>
              <p className="text-sm text-muted">
                Enter the code sent to your email address.
              </p>
              <label className="block font-medium">
                Six-digit code
                <input
                  className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-4 text-base tracking-[.3em] focus:outline-2 focus:outline-primary"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, ""))
                  }
                  required
                />
              </label>
            </>
          )}
          <button
            disabled={busy}
            className="min-h-11 w-full rounded-xl bg-booking px-5 font-bold text-main disabled:opacity-50"
          >
            {busy
              ? "Please wait…"
              : step === "email"
                ? "Send code"
                : "Verify email"}
          </button>
          {step === "code" && (
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-primary"
              onClick={() => {
                setCode("");
                setStep("email");
                setMessage("");
              }}
            >
              Change email
            </button>
          )}
        </form>
      )}
      {message && (
        <p role="status" className="mt-5 text-sm text-muted">
          {message}
        </p>
      )}
      {verified && (
        <a
          href={safeGuestReturnTo(returnTo)}
          className="mt-4 inline-flex min-h-11 items-center font-semibold text-primary"
        >
          {returnTo ? "Continue booking" : "My bookings"}
        </a>
      )}
      {!session && step === "verified" && token && (
        <GuestReservations token={token} reviewsEnabled={reviewsEnabled} />
      )}
    </section>
  );
}
