import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiBase } from "./staff-auth";

type Entry = {
  id: string;
  status: string;
  alias?: string;
  stars?: number;
  comment?: string;
  reply?: string;
  message?: string;
  can_follow_up?: boolean;
};
export default function StaffReviewDesk({
  token,
  feedback = false,
}: {
  token: string;
  feedback?: boolean;
}) {
  const [entries, setEntries] = useState<Entry[]>();
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState<string>();
  const [pairing, setPairing] = useState<string>();
  const [busy, setBusy] = useState(false);
  const path = feedback ? "/staff/private-feedback" : "/staff/reviews";
  useEffect(() => {
    const controller = new AbortController();
    void fetch(apiBase + path + "?page=" + page, {
      signal: controller.signal,
      headers: { Authorization: "Bearer " + token },
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Inbox unavailable.");
        const data = await response.json();
        if (!controller.signal.aborted) setEntries(data.entries);
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage("Inbox unavailable.");
      });
    return () => controller.abort();
  }, [path, page, token, refresh]);
  async function action(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const next = String(fields.get("action"));
    setBusy(true);
    setMessage("");
    setContact(undefined);
    try {
      const response = await fetch(apiBase + path + "/" + id + "/" + next, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json",
          "Idempotency-Key": globalThis.crypto.randomUUID(),
        },
        body: JSON.stringify({
          reasonCode: fields.get("reasonCode") || "",
          reason: fields.get("reason") || "",
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      if (next === "contact_access") setContact((await response.json()).email);
      else setRefresh((v) => v + 1);
      setMessage("Action recorded.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Action unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function walkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const pairingRequest = data.get("flow") === "pair";
    setPairing(undefined);
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(
        apiBase +
          (pairingRequest
            ? "/staff/review-enrollment"
            : "/staff/review-invitations/request"),
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reservation: data.get("reservation") }),
        },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      if (pairingRequest) setPairing((await response.json()).pairing);
      else setMessage("Invitation request accepted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Review access is unavailable.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mt-6 space-y-4">
      <h2 className="text-2xl font-semibold">
        {feedback ? "Private feedback" : "Review moderation"}
      </h2>
      {feedback && (
        <details className="rounded-xl border border-subtle p-4">
          <summary>Optional walk-in review access</summary>
          <form
            className="mt-3 space-y-3"
            onSubmit={(event) => void walkIn(event)}
          >
            <label className="block">
              Reservation identifier
              <input
                name="reservation"
                required
                className="block w-full rounded border border-subtle p-2"
              />
            </label>
            <label className="block">
              Action{" "}
              <select name="flow" className="rounded border border-subtle p-2">
                <option value="pair">Create guest pairing code</option>
                <option value="invite">
                  Request invitation after checkout
                </option>
              </select>
            </label>
            <button
              disabled={busy}
              className="min-h-11 rounded bg-primary px-4 text-white"
            >
              Continue
            </button>
          </form>
          {pairing && (
            <p className="mt-3 break-all">
              Give this one-time code to the primary guest in person:{" "}
              <code>{pairing}</code>
            </p>
          )}
        </details>
      )}
      {message && <p role="status">{message}</p>}
      {contact && <p>Consented follow-up address: {contact}</p>}
      {!entries ? (
        !message && <p role="status">Loading…</p>
      ) : !entries.length ? (
        <p>No records on this page.</p>
      ) : (
        entries.map((entry) => {
          const actions = feedback
            ? [
                ...(entry.status === "new"
                  ? [["in_progress", "Start"]]
                  : entry.status === "in_progress"
                    ? [["resolved", "Resolve"]]
                    : []),
                ...(entry.can_follow_up
                  ? [["contact_access", "Show consented contact"]]
                  : []),
              ]
            : entry.status === "published"
              ? [
                  ["hold", "Hold"],
                  ["hide", "Hide"],
                  ...(!entry.reply ? [["reply", "Reply"]] : []),
                ]
              : entry.status === "held"
                ? [
                    ["hide", "Hide"],
                    ["restore", "Restore"],
                  ]
                : entry.status === "hidden"
                  ? [["restore", "Restore"]]
                  : [];
          return (
            <article
              key={entry.id}
              className="space-y-3 rounded-xl border border-subtle p-4"
            >
              <h3 className="font-semibold">
                {feedback
                  ? entry.status.replaceAll("_", " ")
                  : entry.alias +
                    " · " +
                    entry.stars +
                    " out of 5 · " +
                    entry.status}
              </h3>
              <p className="whitespace-pre-wrap break-words">
                {entry.message ?? entry.comment}
              </p>
              {entry.reply && <p>Hotel reply: {entry.reply}</p>}
              {actions.length > 0 && (
                <form
                  className="space-y-3"
                  onSubmit={(event) => void action(event, entry.id)}
                >
                  <label className="block">
                    Action{" "}
                    <select
                      name="action"
                      className="rounded border border-subtle p-2"
                    >
                      {actions.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!feedback && (
                    <>
                      <label className="block">
                        Policy reason{" "}
                        <select
                          name="reasonCode"
                          className="rounded border border-subtle p-2"
                        >
                          <option value="">Select for moderation</option>
                          <option value="spam_fraud">Spam or fraud</option>
                          <option value="abuse">
                            Threat, harassment or abuse
                          </option>
                          <option value="private_information">
                            Private information
                          </option>
                          <option value="prohibited_content">
                            Unrelated or prohibited content
                          </option>
                        </select>
                      </label>
                      <label className="block">
                        Reason or public reply
                        <textarea
                          name="reason"
                          maxLength={2000}
                          required
                          className="block w-full rounded border border-subtle p-2"
                        />
                      </label>
                    </>
                  )}
                  <button
                    disabled={busy}
                    className="min-h-11 rounded bg-primary px-4 text-white"
                  >
                    Record action
                  </button>
                </form>
              )}
            </article>
          );
        })
      )}
      <div className="flex gap-3">
        {page > 1 && (
          <button
            onClick={() => {
              setPage(page - 1);
              setContact(undefined);
              setEntries(undefined);
            }}
          >
            Previous page
          </button>
        )}
        {entries?.length === 20 && (
          <button
            onClick={() => {
              setPage(page + 1);
              setContact(undefined);
              setEntries(undefined);
            }}
          >
            Next page
          </button>
        )}
      </div>
    </section>
  );
}
