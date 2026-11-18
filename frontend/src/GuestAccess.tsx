import { useState } from "react";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiBase, staffAuth } from "./staff-auth";

export default function GuestAccess({
  authClient = staffAuth,
}: {
  authClient?: SupabaseClient | null;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code" | "verified">("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      setStep("code");
      setMessage(
        "If the address can receive mail, a six-digit code will arrive shortly.",
      );
    } catch {
      setMessage(
        "We could not send a code right now. Please try again shortly.",
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
      setStep("verified");
      setMessage(
        "Email verified. Reservation access will be available when online booking opens.",
      );
    } catch {
      setMessage("Verification is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-3xl border border-subtle bg-white p-7 shadow-sm sm:p-10">
      <p className="text-xs font-bold uppercase tracking-[.2em] text-primary">
        Guest access
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-main">
        Your stay, kept private.
      </h1>
      <p className="mt-3 text-muted">
        Verify your email before accessing reservation details. Booking is
        coming in a later phase.
      </p>
      {!authClient ? (
        <p className="mt-8 text-muted">
          Guest verification is not configured for this preview.
        </p>
      ) : step === "verified" ? (
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
                ? "Send verification code"
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
              Use another email
            </button>
          )}
        </form>
      )}
      {message && (
        <p role="status" className="mt-5 text-sm text-muted">
          {message}
        </p>
      )}
    </section>
  );
}
