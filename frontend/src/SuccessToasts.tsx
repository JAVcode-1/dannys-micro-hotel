import { useEffect } from "react";
import { Toaster } from "sonner";
import { restoreSuccessToast } from "./notifications";

export default function SuccessToasts() {
  useEffect(restoreSuccessToast, []);
  return (
    <Toaster
      position="top-right"
      duration={4500}
      closeButton
      visibleToasts={3}
      toastOptions={{
        style: {
          background: "var(--surface-canvas)",
          color: "var(--text-main)",
          borderColor: "var(--border-subtle)",
        },
      }}
    />
  );
}
