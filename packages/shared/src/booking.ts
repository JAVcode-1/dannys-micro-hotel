export type BookingItemInput = {
  category: "double_standard" | "family_executive";
  startAt: string;
  blocks: number[];
  adults: number;
  children: number;
  extraBed: boolean;
};

export type BookingQuote = {
  items: (BookingItemInput & {
    endAt: string;
    packages: {
      id: string;
      version: number;
      durationMinutes: number;
      priceCentavos: number;
    }[];
    baseCentavos: number;
    extraBedCentavos: number;
    totalCentavos: number;
    advisory: string | null;
  })[];
  totalCentavos: number;
};

export type GuestReservation = {
  id: string;
  primaryName: string;
  createdAt: string;
  totalCentavos: number;
  financials?: import("./stay-changes.js").StayFinancials;
  items: {
    id: string;
    category: string;
    startAt: string;
    endAt: string;
    originalCheckoutAt?: string | null;
    effectiveCheckoutAt?: string | null;
    additionalCharges?: {
      kind: string;
      amountCentavos: number;
      paidCentavos: number;
      creditedCentavos: number;
    }[];
    adults: number;
    children: number;
    totalCentavos: number;
    state: string;
    proofDeadlineAt: string;
    scheduleRevision?: number;
    pendingReschedule?: boolean;
    confirmationAt?: string | null;
    blocks?: number[];
  }[];
};
