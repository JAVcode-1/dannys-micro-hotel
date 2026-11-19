export type WalkInPaymentInput = {
  requestKey: string;
  method: "cash" | "gcash";
  amountCentavos: number;
  verification?: {
    reference: string;
    recipient: string;
    receivedAt: string;
    ledgerChecked: boolean;
    receivingAccountChecked: boolean;
    timeChecked: boolean;
  };
};
export type WalkInBooking = {
  id: string;
  primaryName: string;
  createdAt: string;
  totalCentavos: number;
  collectedCentavos: number;
  balanceCentavos: number;
  minimumCentavos: number;
  paymentMinimumMet: boolean;
  normalCheckInEligible: boolean;
  items: {
    id: string;
    category: string;
    startAt: string;
    endAt: string;
    totalCentavos: number;
    provisionalRoomCode: string;
    claimState: string;
  }[];
  ledger: {
    id: string;
    kind: "charge" | "payment";
    method: "cash" | "gcash" | null;
    amountCentavos: number;
    transactionReference: string | null;
    actorId: string;
    recordedAt: string;
    receivedAt: string | null;
  }[];
};
