export type ExtensionInput = {
  requestKey: string;
  expectedRevision: number;
  blocks: number[];
  reason: string;
};
export type ExtensionDecisionInput = {
  requestKey: string;
  expectedRevision: number;
  approved: boolean;
  reason: string;
};
export type StayEvent = {
  id: string;
  kind: string;
  roomBookingId: string;
  recordedAt: string;
};
export type StayReceiptInput = {
  requestKey: string;
  method: "cash" | "gcash";
  amountCentavos: number;
  receivedAt: string;
  reason: string;
  cashReceived?: true;
  verification?: {
    reference: string;
    recipient: string;
    ledgerChecked: true;
    receivingAccountChecked: true;
    timeChecked: true;
  };
};
export type StayAllocationInput = {
  requestKey: string;
  extensionRequestId?: string;
  chargeId?: string;
  amountCentavos: number;
  reason: string;
};
export type StayReviewInput = {
  requestKey: string;
  kind: "overtime" | "smoking";
  reason: string;
  startAt?: string;
  endAt?: string;
  policyVersionId?: string;
  disclosureId?: string;
};
export type StayFinancials = {
  originalCentavos: number;
  netChargeCentavos: number;
  collectedCentavos: number;
  balanceCentavos: number;
  settlementDueCentavos: number;
  refundDueCentavos: number;
  unallocatedX03Centavos: number;
  pendingExtensionFundsCentavos: number;
};
export type ExtensionRow = {
  id: string;
  oldEnd: string;
  newEnd: string;
  revision: number;
  blocks: number[];
  amountCentavos: number;
  fundedCentavos: number;
  approved: boolean | null;
  blocker: string | null;
  reason: string;
};
export type StayChargeRow = {
  id: string;
  kind: string;
  amountCentavos: number;
  paidCentavos: number;
  creditedCentavos: number;
  reviewId: string | null;
  reason: string;
};
export type StayReceiptRow = {
  id: string;
  method: string;
  amountCentavos: number;
  availableCentavos: number;
};
export type StayAllocationRow = {
  id: string;
  receiptId: string;
  requestId: string | null;
  chargeId: string | null;
  amountCentavos: number;
  released: boolean;
  releasable: boolean;
};
export type StayReviewRow = {
  id: string;
  kind: string;
  reason: string;
  blocker: string | null;
  decided: boolean;
  durationMs: number | null;
};
export type StayChangeRow = {
  id: string;
  reservationId: string;
  category: string;
  channel: string;
  roomCode: string;
  originalCheckoutAt: string;
  effectiveCheckoutAt: string;
  revision: number;
  checkedOut: boolean;
  financials: StayFinancials;
  extensions: ExtensionRow[];
  receipts: StayReceiptRow[];
  allocations: StayAllocationRow[];
  charges: StayChargeRow[];
  reviews: StayReviewRow[];
};
