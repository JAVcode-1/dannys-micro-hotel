export type PaymentDecision =
  | "confirmed"
  | "rejected"
  | "mismatched"
  | "unresolved"
  | "late_reconciliation";
export type PaymentReviewInput = {
  decision: PaymentDecision;
  expectedVersion: number;
  requestKey: string;
  note: string;
  receivedAmountCentavos?: number;
  verification?: {
    ledgerChecked: boolean;
    receivingAccountChecked: boolean;
    timeChecked: boolean;
    reference: string;
    recipient: string;
    amountCentavos: number;
    receivedAt: string;
  };
};
export type StaffPaymentReview = {
  hallItems?: import("./booking.js").OnlineHallItem[];
  serviceKind?: "accommodation" | "hall" | "combined";
  id: string;
  reservationId: string;
  primaryName: string;
  transactionReference: string | null;
  payeeLabel?: string | null;
  amountDueCentavos: number;
  submittedAt: string;
  status: "pending_review" | PaymentDecision;
  version: number;
  age: "on_time" | "overdue" | "urgent" | "critical";
  duplicateReference: boolean;
  lastReview?: { note: string; actorId: string; createdAt: string } | null;
  items: {
    category: string;
    startAt: string;
    endAt: string;
    totalCentavos: number;
  }[];
};
