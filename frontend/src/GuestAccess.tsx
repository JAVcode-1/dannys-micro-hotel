import { useEffect, useRef, useState } from "react";
import SignInLayout from "./SignInLayout";
import { notifySuccess } from "./notifications";
import type { FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { apiBase, guestAuth } from "./staff-auth";
import GuestReservations from "./GuestReservations";
import { safeGuestReturnTo, useGuestSession } from "./GuestSession";

const cooldownKey = "staytrack.guest-otp.next-send";
function storedNextSend() {
  try {
    const value = Number(window.localStorage.getItem(cooldownKey));
    return Number.isFinite(value) ? Math.min(value, Date.now() + 60_000) : 0;
  } catch {
    return 0;
  }
}

export default function GuestAccess({
  authClient = guestAuth,
  reviewsEnabled = false,
}: {
  authClient?: SupabaseClient | null;
  reviewsEnabled?: boolean;
}) {
  const [email, setEmail] = useState("");
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const code = digits.join("");
  const codeInputs = useRef<(HTMLInputElement | null)[]>([]);
  const [codeError, setCodeError] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [step, setStep] = useState<"email" | "code" | "verified">("email");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const [nextSend, setNextSend] = useState(storedNextSend);
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((nextSend - now) / 1000));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setNextSend((current) => Math.max(current, storedNextSend()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);
  function startCooldown() {
    const deadline = Date.now() + 60_000;
    setNow(Date.now());
    setNextSend(deadline);
    try {
      window.localStorage.setItem(cooldownKey, String(deadline));
    } catch {
      /* Provider limits still apply without storage. */
    }
  }
  const [token, setToken] = useState("");
  const session = useGuestSession();
  const verified =
    session?.access.status === "authenticated" || step === "verified";
  const returnTo =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("returnTo");

  async function send(event?: FormEvent) {
    event?.preventDefault();
    if (
      !authClient ||
      busy ||
      sending.current ||
      Date.now() < Math.max(nextSend, storedNextSend())
    )
      return;
    sending.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { error } = await authClient.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      startCooldown();
      setDigits(Array(6).fill(""));
      setCodeError(false);
      setShaking(false);
      notifySuccess("Verification code requested. Check your email.");
      setStep("code");
      setMessage(
        "Code requested. Check your inbox or spam folder and use the most recent email code.",
      );
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? error.code
          : undefined;
      if (
        code === "over_email_send_rate_limit" ||
        code === "over_request_rate_limit"
      )
        startCooldown();
      setMessage(
        code === "email_address_not_authorized"
          ? "Email delivery is not configured for customer addresses. Please contact the hotel."
          : code === "over_email_send_rate_limit" ||
              code === "over_request_rate_limit"
            ? "Too many code requests. Please wait before trying again."
            : "We could not send a code right now. Please try again shortly.",
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!authClient || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setCodeError(true);
      setMessage("Enter all six digits from your email.");
      codeInputs.current[digits.findIndex((digit) => !digit)]?.focus();
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await authClient.auth.verifyOtp({
        email: email.trim(),
        token: code,
        type: "email",
      });
      if (error) {
        if (error.code === "otp_expired") {
          setCodeError(true);
          setShaking(true);
          setMessage(
            "The code is invalid or expired. Use the most recent email code or request another below.",
          );
        } else if (
          error.status === 429 ||
          error.code === "over_request_rate_limit"
        ) {
          setMessage(
            "Too many verification attempts. Please wait a few minutes before trying again.",
          );
        } else {
          setMessage("Verification is unavailable. Please try again shortly.");
        }
        return;
      }
      if (
        !data.session ||
        !data.user?.email ||
        data.user.email.toLowerCase() !== email.trim().toLowerCase()
      ) {
        setMessage(
          "Email verification could not be confirmed. Please request a new code.",
        );
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
      setDigits(Array(6).fill(""));
      setToken(data.session.access_token);
      setStep("verified");
      setMessage(
        "Email verified. Reservation lookup uses your verified identity.",
      );
      notifySuccess(
        "Email verified. Signed in successfully.",
        Boolean(returnTo),
      );
      if (returnTo) window.location.assign(safeGuestReturnTo(returnTo));
    } catch {
      setMessage("Verification is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function enterDigits(value: string, index: number) {
    const incoming = value.replace(/\D/g, "").slice(0, 6);
    const start = incoming.length === 6 ? 0 : index;
    setDigits((current) => {
      const next = [...current];
      if (!incoming) next[index] = "";
      else
        incoming.split("").forEach((digit, offset) => {
          if (start + offset < 6) next[start + offset] = digit;
        });
      return next;
    });
    setCodeError(false);
    setShaking(false);
    setMessage("");
    if (incoming)
      codeInputs.current[Math.min(start + incoming.length, 5)]?.focus();
  }

  if (step === "code" && !verified && authClient)
    return (
      <section className="email-code-screen" aria-labelledby="email-code-title">
        <div className="email-code-form">
          <p className="email-code-eyebrow">EMAIL VERIFICATION</p>
          <h1 id="email-code-title">Check your inbox.</h1>
          <p>
            Enter the six-digit code sent to <strong>{email.trim()}</strong>.
          </p>
          <form onSubmit={(event) => void verify(event)}>
            <fieldset disabled={busy} className="email-code-fields">
              <legend className="sr-only">
                Six-digit email verification code
              </legend>
              <div
                className="email-code-boxes"
                data-invalid={codeError || undefined}
                data-shaking={shaking || undefined}
                onAnimationEnd={() => setShaking(false)}
              >
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      codeInputs.current[index] = element;
                    }}
                    aria-label={`Digit ${index + 1} of 6`}
                    aria-invalid={codeError}
                    aria-describedby={
                      message ? "email-code-message" : undefined
                    }
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    autoFocus={index === 0}
                    maxLength={index === 0 ? 6 : 1}
                    value={digit}
                    onFocus={(event) => event.currentTarget.select()}
                    onChange={(event) => enterDigits(event.target.value, index)}
                    onPaste={(event) => {
                      event.preventDefault();
                      enterDigits(event.clipboardData.getData("text"), index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Backspace") {
                        event.preventDefault();
                        const target = digit ? index : Math.max(0, index - 1);
                        enterDigits("", target);
                        codeInputs.current[target]?.focus();
                      } else if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight"
                      ) {
                        event.preventDefault();
                        codeInputs.current[
                          Math.max(
                            0,
                            Math.min(
                              5,
                              index + (event.key === "ArrowLeft" ? -1 : 1),
                            ),
                          )
                        ]?.focus();
                      }
                    }}
                  />
                ))}
              </div>
              <button className="email-code-submit" type="submit">
                {busy ? "Verifying…" : "Verify email"}
              </button>
            </fieldset>
            {message && (
              <p
                id="email-code-message"
                role={codeError ? "alert" : "status"}
                className="email-code-message"
              >
                {message}
              </p>
            )}
            <p className="mt-4 text-sm text-muted">
              Didn’t receive an email? Check spam, or request another code.
              Requests are limited to once every 60 seconds; additional email
              limits may apply.
            </p>
            <button
              type="button"
              className="email-code-change"
              disabled={busy || remaining > 0}
              onClick={() => void send()}
            >
              {remaining > 0 ? `Resend code in ${remaining}s` : "Resend code"}
            </button>{" "}
            <button
              type="button"
              className="email-code-change"
              disabled={busy}
              onClick={() => {
                setDigits(Array(6).fill(""));
                setStep("email");
                setMessage("");
                setCodeError(false);
                setShaking(false);
              }}
            >
              Change email
            </button>
          </form>
        </div>
        <aside
          className="email-code-device"
          aria-label="Where to find your code"
        >
          <div className="email-code-phone" aria-hidden="true">
            <div className="email-code-phone-camera" />
            <img src="/hotel/logo.webp" width="238" height="225" alt="" />
            <span className="email-code-envelope">✉</span>
            <strong>Your code is in your email</strong>
            <div className="email-code-phone-dots">
              {Array.from({ length: 6 }, (_, index) => (
                <span key={index} />
              ))}
            </div>
          </div>
          <h2>Open your email</h2>
          <p>
            Check your inbox or spam folder. You can type the code or paste all
            six digits at once.
          </p>
        </aside>
      </section>
    );

  return (
    <SignInLayout reviewsEnabled={reviewsEnabled}>
      <section className="signin-form-content">
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
            Email verification is unavailable because authentication is not
            configured. Please contact the hotel.
          </p>
        ) : verified ? (
          <p className="mt-8 rounded-xl bg-selected p-4 text-primary">
            Email verified.
          </p>
        ) : (
          <form
            onSubmit={(event) => void send(event)}
            className="mt-8 space-y-5"
          >
            <label className="block font-medium">
              Email address
              <input
                className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-4 text-base focus:outline-2 focus:outline-primary"
                type="email"
                disabled={busy}
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <button
              disabled={busy || remaining > 0}
              className="min-h-11 w-full rounded-xl bg-booking px-5 font-bold text-main disabled:opacity-50"
            >
              {busy
                ? "Please wait…"
                : remaining > 0
                  ? `Send code in ${remaining}s`
                  : "Send code"}
            </button>
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
    </SignInLayout>
  );
}
