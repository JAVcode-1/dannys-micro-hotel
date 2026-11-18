export type PaymentSession = {
  reservationId: string;
  amountDueCentavos: number;
  serverNow: string;
  proofDeadlineAt: string;
  status: "awaiting_proof" | "pending_review" | "expired" | "unavailable";
  payeeLabel: string | null;
  qrUrl: string | null;
  emailReminderAt: string[];
  emailDeliveryEnabled: false;
};
