import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { notifySuccess } from "./notifications";
import { apiBase } from "./staff-auth";
import StaffLoadingSkeleton, { SkeletonBlock } from "./StaffLoadingSkeleton";

export default function PaymentQrSettings({ token }: { token: string }) {
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setQr(null);
    setLoading(true);
    const controller = new AbortController();
    void fetch(`${apiBase}/staff/payment-qr`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = (await response.json()) as {
          payeeLabel: string | null;
          qrUrl: string | null;
        };
        setQr(data.qrUrl);
        setLabel(data.payeeLabel ?? "");
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setMessage(
            "The payment QR is unavailable. Contact your administrator.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, refresh]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    if (
      !file ||
      !label.trim() ||
      !["image/png", "image/jpeg"].includes(file.type) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setMessage(
        "Choose a PNG/JPEG up to 5 MB and enter the verified payee label.",
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${apiBase}/staff/payment-qr`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": file.type,
          "X-GCash-Payee": encodeURIComponent(label.trim()),
        },
        body: file,
      });
      if (!response.ok) throw new Error();
      setMessage(
        "QR configuration saved and audited. Guest payments remain disabled.",
      );
      setRefresh((value) => value + 1);
      notifySuccess("GCash QR configuration saved.");
    } catch {
      setMessage(
        "QR could not be saved. Check private Storage setup and image format.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="staff-management-card staff-settings-payment">
      <h3 className="text-lg font-semibold">GCash QR image</h3>
      <p className="mt-2 text-sm text-muted">
        Upload the hotel-approved QR and verify its recipient. Saving an image
        does not open guest payments.
      </p>
      {loading && (
        <StaffLoadingSkeleton label="Loading payment QR…" className="mt-4">
          <div className="w-fit max-w-full rounded-xl border border-subtle bg-white p-2">
            <SkeletonBlock className="aspect-square w-40" />
          </div>
        </StaffLoadingSkeleton>
      )}
      {qr && (
        <img
          src={qr}
          alt="Current private GCash QR configuration"
          className="mt-4 max-h-48 max-w-full rounded-xl border border-subtle bg-white object-contain p-2"
        />
      )}
      <form onSubmit={(event) => void submit(event)} className="mt-5 space-y-4">
        <fieldset disabled={busy} className="space-y-4">
          <legend className="sr-only">Configure GCash QR</legend>
          <label className="block text-sm font-semibold">
            Verified GCash account name
            <input
              required
              maxLength={120}
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-subtle px-3 text-base"
            />
          </label>
          <label className="block text-sm font-semibold">
            Hotel QR image (PNG/JPEG, up to 5 MB)
            <input
              required
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-2 block min-h-11 w-full text-base"
            />
          </label>
          <button className="min-h-11 rounded-xl bg-primary px-5 font-semibold text-white">
            {busy ? "Uploading…" : "Save payment QR"}
          </button>
        </fieldset>
      </form>
      {message && (
        <p role="status" className="mt-4 text-sm text-muted">
          {message}
        </p>
      )}
    </section>
  );
}
