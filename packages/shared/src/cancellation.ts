export type CancellationRow = {
  id: string;
  reservationId: string;
  channel: string;
  category: string;
  startAt: string;
  endAt: string;
  originalCentavos: number;
  requestedAt: string;
  confirmationAt: string | null;
  eligibility: string;
  approved: boolean | null;
  refundCentavos: number | null;
  refundedCentavos: number;
  remainingRefundCentavos: number;
  decisionReason: string | null;
  refundStatus: "not_due" | "due" | "processing" | "recorded";
  paymentId: string | null;
  claimedBy: string | null;
  payerName: string | null;
  payerAccount: string | null;
  verifiedAt: string | null;
  transferReference: string | null;
  transferredAt: string | null;
  transferHistory: {
    amountCentavos: number;
    reference: string;
    transferredAt: string;
  }[];
  balanceCentavos: number;
  refundDueCentavos: number;
  netChargeCentavos: number;
};
export type CancellationDecisionInput = {
  requestKey: string;
  approved: boolean;
  reason: string;
};
export type RefundAction =
  | {
      action: "claim";
      requestKey: string;
      originalPaymentId: string;
      payerName: string;
      payerAccount: string;
      verificationNote: string;
      ledgerChecked: true;
      originalPayerMatched: true;
    }
  | {
      action: "transfer";
      requestKey: string;
      amountCentavos: number;
      reference: string;
      transferredAt: string;
      transferChecked: true;
    };
