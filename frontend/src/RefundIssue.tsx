import { useEffect, useState, type FormEvent } from "react";
import { apiBase } from "./staff-auth";
import { parsePesoInput } from "./peso-input";

type Props = { token: string; kind: "room" | "hall"; itemId: string };
type Issue = {
  receivedCentavos: number;
  details: string;
  status: "open" | "resolved";
  resolution: string | null;
};

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function GuestRefundIssue(props: Props) {
  return (
    <RefundIssue
      key={`${props.kind}:${props.itemId}`}
      {...props}
      role="guest"
    />
  );
}

export function StaffRefundIssue(props: Props) {
  return (
    <RefundIssue
      key={`${props.kind}:${props.itemId}`}
      {...props}
      role="staff"
    />
  );
}

export function StaffRefundIssueQueue({ token }: { token: string }) {
  const [items, setItems] = useState<
    {
      kind: Props["kind"];
      itemId: string;
      reservationId: string;
      reportedAt: string;
    }[]
  >();
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${apiBase}/staff/refund-issues`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!controller.signal.aborted) {
          setItems(result.items);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [token, revision]);
  return (
    <section
      aria-label="Open refund reports"
      className="space-y-2 rounded-xl border border-subtle p-4"
    >
      <h2 className="font-bold">Open refund reports</h2>
      <button
        type="button"
        className="min-h-11 font-semibold text-primary"
        onClick={() => setRevision((value) => value + 1)}
      >
        Refresh refund reports
      </button>
      {failed ? (
        <p role="status">Refund reports are unavailable.</p>
      ) : !items ? (
        <p role="status">Loading refund reports…</p>
      ) : !items.length ? (
        <p>No open refund reports.</p>
      ) : (
        items.map((item) => (
          <article
            key={`${item.kind}:${item.itemId}`}
            className="border-t border-subtle pt-2"
          >
            <p>
              {item.kind === "hall" ? "Function Hall" : "Room"} booking{" "}
              {item.reservationId.slice(0, 8).toUpperCase()}
            </p>
            <a
              className="font-semibold text-primary"
              href={`/staff/reservations/${encodeURIComponent(item.reservationId)}`}
            >
              View booking
            </a>
            <StaffRefundIssue
              token={token}
              kind={item.kind}
              itemId={item.itemId}
            />
          </article>
        ))
      )}
    </section>
  );
}

function RefundIssue({
  token,
  kind,
  itemId,
  role,
}: Props & { role: "guest" | "staff" }) {
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState<Issue | null>();
  const [amount, setAmount] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const path = `${apiBase}/${role}/refund-issues/${kind}/${encodeURIComponent(itemId)}`;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setIssue(undefined);
    setError("");
    void fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const result = (await response.json()) as { issue: Issue | null };
        if (!controller.signal.aborted) setIssue(result.issue);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "Refund reports are unavailable. Close and reopen to try again.",
          );
      });
    return () => controller.abort();
  }, [open, path, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body =
        role === "staff"
          ? { resolution: text }
          : { details: text, receivedCentavos: parsePesoInput(amount) };
      const response = await fetch(path, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as {
        issue?: Issue;
        error?: string;
      };
      if (!response.ok || !result.issue)
        throw new Error(result.error ?? "Refund report could not be saved.");
      setIssue(result.issue);
      setText("");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Refund report could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  const canSubmit =
    role === "guest" ? issue === null : issue?.status === "open";
  return (
    <details
      className="mt-3 text-sm"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="min-h-11 cursor-pointer font-semibold text-primary">
        {role === "guest"
          ? "Report a refund problem"
          : "Refund problem reports"}
      </summary>
      {open && (
        <div className="space-y-2">
          {error && <p role="alert">{error}</p>}
          {issue === undefined && !error && (
            <p role="status">Loading refund report…</p>
          )}
          {issue && (
            <div role="status">
              <p>
                {issue.status === "open"
                  ? "Refund problem reported. Awaiting staff review."
                  : "Refund report resolved."}
              </p>
              <p>
                Amount guest received:{" "}
                {money.format(issue.receivedCentavos / 100)}
              </p>
              <p className="break-words">{issue.details}</p>
              {issue.resolution && (
                <p className="break-words">
                  Staff response: {issue.resolution}
                </p>
              )}
            </div>
          )}
          {role === "staff" && issue === null && (
            <p>No refund problem reported.</p>
          )}
          {canSubmit && (
            <form
              onSubmit={(event) => void submit(event)}
              className="space-y-3"
            >
              {role === "guest" && (
                <label className="block">
                  Amount you received (PHP)
                  <input
                    className="block min-h-11 rounded border border-subtle px-2"
                    required
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                  />
                </label>
              )}
              <label className="block">
                {role === "guest"
                  ? "What happened?"
                  : "Resolution shared with the guest"}
                <textarea
                  className="block w-full rounded border border-subtle p-2"
                  required
                  maxLength={1000}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                />
              </label>
              <p>
                {role === "guest"
                  ? "Keep account numbers and payment credentials out of this report."
                  : "Check the GCash transfer records before resolving the report."}
              </p>
              <button
                className="min-h-11 rounded bg-primary px-4 text-white disabled:opacity-50"
                disabled={busy}
              >
                {role === "guest" ? "Send refund report" : "Record resolution"}
              </button>
            </form>
          )}
        </div>
      )}
    </details>
  );
}
