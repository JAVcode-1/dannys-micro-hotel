import { writeApi } from "./api-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiBase } from "./staff-auth";
import { notifySuccess } from "./notifications";

type Purpose = "review" | "feedback" | "withdrawal" | "enrollment";

export default function GuestReviewAccess({
  initial = "review",
  token,
  reservation,
}: {
  initial?: Purpose;
  token?: string;
  reservation?: string;
}) {
  const [purpose, setPurpose] = useState<Purpose>(initial);
  const [challenge, setChallenge] = useState("");
  const [grant, setGrant] = useState("");
  const [grantPurpose, setGrantPurpose] = useState<Purpose>();
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState(() =>
    globalThis.crypto.randomUUID(),
  );
  const [initialLink] = useState(() =>
    new URLSearchParams(globalThis.location?.hash.slice(1) ?? "").get("review"),
  );
  async function send(
    path: string,
    body: Record<string, unknown>,
    key?: string,
  ) {
    const response = await writeApi(apiBase + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {}),
        ...(key ? { "Idempotency-Key": key } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error((await response.json()).error ?? "Request unavailable.");
    return response.status === 204 ? {} : await response.json();
  }
  useEffect(() => {
    if (initialLink) {
      const url = new URL(globalThis.location.href);
      url.hash = "";
      globalThis.history.replaceState(null, "", url);
    }
  }, [initialLink]);
  async function run(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      await operation();
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error ? cause.message : "Request unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      if (!grant && !(token && reservation)) {
        if (purpose === "review") {
          const result = await send("/review-invitations/verify", {
            token: initialLink ?? data.get("invitation"),
          });
          setGrant(result.token);
          setGrantPurpose("review");
          notifySuccess("Review access verified.");
        } else if (!challenge) {
          const result =
            purpose === "enrollment"
              ? await send("/review-access/enroll", {
                  pairing: data.get("pairing"),
                  email: data.get("email"),
                })
              : await send("/review-access/otp", {
                  reservation: data.get("reservation"),
                  email: data.get("email"),
                  purpose,
                });
          setChallenge(result.challenge);
          notifySuccess(
            "Verification code requested. Check your email if the details match.",
          );
          setMessage(
            "If the details match, a verification code will arrive by email.",
          );
        } else {
          const result = await send("/review-access/verify", {
            challenge,
            code: data.get("code"),
            consent: data.has("invitationConsent"),
          });
          if (result.enrolled) {
            setChallenge("");
            setMessage("Email verified for this stay.");
            notifySuccess("Email verified for this stay.");
          } else {
            setGrant(result.token);
            setGrantPurpose(purpose);
            notifySuccess("Access verified.");
          }
        }
        return;
      }
      const access = grant ? { grant } : { reservation };
      if (purpose === "review")
        await send(
          "/reviews",
          {
            ...access,
            stars: Number(data.get("stars")),
            comment: data.get("comment"),
            consent: data.has("consent"),
          },
          requestKey,
        );
      if (purpose === "feedback")
        await send(
          "/private-feedback",
          {
            ...access,
            message: data.get("feedback"),
            followUp: data.has("followUp"),
          },
          requestKey,
        );
      if (purpose === "withdrawal")
        await send("/reviews/withdrawal", access, requestKey);
      notifySuccess(
        purpose === "review"
          ? "Review submitted."
          : purpose === "feedback"
            ? "Private feedback sent."
            : "Review withdrawn.",
      );
      setMessage(
        purpose === "review"
          ? "Review submitted."
          : purpose === "feedback"
            ? "Private feedback sent."
            : "Review withdrawn.",
      );
    });
  }
  const verified = Boolean(grant || (token && reservation));
  return (
    <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-subtle bg-white p-6">
      <h1 className="text-2xl font-semibold">
        {purpose === "review"
          ? "Review your stay"
          : purpose === "feedback"
            ? "Private feedback"
            : purpose === "enrollment"
              ? "Verify walk-in email"
              : "Withdraw your review"}
      </h1>
      <label className="block">
        Action{" "}
        <select
          disabled={busy}
          value={purpose}
          onChange={(event) => {
            const next = event.target.value as Purpose;
            setPurpose(next);
            if (
              grantPurpose !== next &&
              !(grantPurpose === "review" && next === "feedback")
            )
              setGrant("");
            setChallenge("");
            setMessage("");
            setRequestKey(globalThis.crypto.randomUUID());
          }}
          className="ml-2 rounded border border-subtle p-2"
        >
          <option value="review">Public review</option>
          <option value="feedback">Private feedback</option>
          <option value="withdrawal">Withdraw review</option>
          {!token && <option value="enrollment">Verify walk-in email</option>}
        </select>
      </label>
      <form onSubmit={submit} className="space-y-4">
        {!verified &&
          (purpose === "review" ? (
            !initialLink && (
              <label className="block">
                Invitation code
                <input
                  name="invitation"
                  required
                  className="block w-full rounded border border-subtle p-2"
                />
              </label>
            )
          ) : challenge ? (
            <label className="block">
              Email verification code
              <input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                className="block w-full rounded border border-subtle p-2"
              />
              {purpose === "enrollment" && (
                <span className="block">
                  <input name="invitationConsent" type="checkbox" /> Send me a
                  review invitation after checkout.
                </span>
              )}
            </label>
          ) : (
            <>
              <label className="block">
                {purpose === "enrollment"
                  ? "Pairing code from staff"
                  : "Reservation identifier"}
                <input
                  name={purpose === "enrollment" ? "pairing" : "reservation"}
                  required
                  className="block w-full rounded border border-subtle p-2"
                />
              </label>
              <label className="block">
                Verified reservation email
                <input
                  name="email"
                  type="email"
                  required
                  className="block w-full rounded border border-subtle p-2"
                />
              </label>
            </>
          ))}
        {verified && purpose === "review" && (
          <>
            <fieldset>
              <legend>Rating</legend>
              <div className="flex flex-wrap gap-4">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <label key={rating}>
                    <input name="stars" type="radio" value={rating} required />{" "}
                    {rating} {rating === 1 ? "star" : "stars"}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              Comment (optional)
              <textarea
                name="comment"
                maxLength={2000}
                className="block w-full rounded border border-subtle p-2"
              />
            </label>
            <label className="block">
              <input type="checkbox" name="consent" required /> I agree to
              publish this review under a guest alias.
            </label>
          </>
        )}
        {verified && purpose === "feedback" && (
          <>
            <label className="block">
              Message to hotel staff
              <textarea
                name="feedback"
                required
                maxLength={4000}
                className="block w-full rounded border border-subtle p-2"
              />
            </label>
            <label className="block">
              <input type="checkbox" name="followUp" /> Staff may follow up
              using my verified email.
            </label>
          </>
        )}
        {verified && purpose === "withdrawal" && (
          <p>
            Withdrawal removes the published review. It does not reopen rating
            submission.
          </p>
        )}
        <button
          disabled={busy}
          className="min-h-11 rounded bg-primary px-4 text-white disabled:opacity-50"
        >
          {verified
            ? purpose === "withdrawal"
              ? "Withdraw review"
              : "Submit"
            : purpose === "review" || challenge
              ? "Verify access"
              : "Send code"}
        </button>
      </form>
      {token && reservation && purpose === "review" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              await send("/review-invitations/request", {
                reservation,
                consent: true,
              });
              notifySuccess(
                "Review invitation requested. Email delivery depends on stay eligibility.",
              );
              setMessage(
                "If the stay qualifies, an invitation will arrive at the verified booking email.",
              );
            });
          }}
          className="space-y-2 border-t border-subtle pt-3"
        >
          <label className="block">
            <input type="checkbox" required /> Send a review invitation to my
            verified booking email.
          </label>
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 text-primary"
          >
            Request invitation
          </button>
        </form>
      )}
      {message && <p role={error ? "alert" : "status"}>{message}</p>}
    </section>
  );
}
