export type PaymentSession = {
  allocations?: { label: string; amountCentavos: number }[];
  reservationId: string;
  amountDueCentavos: number;
  receivedAmountCentavos?: number | null;
  serverNow: string;
  proofDeadlineAt: string;
  status:
    | "awaiting_proof"
    | "pending_review"
    | "confirmed"
    | "expired"
    | "unavailable";
  payeeLabel: string | null;
  qrUrl: string | null;
  emailReminderAt: string[];
  emailDeliveryEnabled: false;
};
