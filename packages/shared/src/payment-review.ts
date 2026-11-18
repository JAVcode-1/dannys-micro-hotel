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
  id: string;
  reservationId: string;
  primaryName: string;
  transactionReference: string;
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
