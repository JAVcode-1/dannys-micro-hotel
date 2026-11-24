/** Display labels only; API state values and identifiers stay unchanged. */
export function readableLabel(value: string): string {
  const labels: Record<string, string> = {
    double_standard: "Double Standard",
    family_executive: "Family Executive",
    awaiting_proof: "Awaiting payment",
    proof_pending_review: "Payment under review",
    pending_review: "Under review",
    confirmed: "Confirmed",
    checked_in: "Checked in",
    checked_out: "Checked out",
    gcash: "GCash",
    walk_in: "Walk-in",
  };
  return (
    labels[value] ??
    value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
  );
}

export function bookingReference(id: string): string {
  return `Booking ${id.slice(0, 8).toUpperCase()}`;
}
