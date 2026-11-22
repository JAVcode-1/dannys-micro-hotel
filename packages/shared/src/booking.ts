export type BookingItemInput = {
  category: "double_standard" | "family_executive";
  startAt: string;
  blocks: number[];
  adults: number;
  children: number;
  extraBed: boolean;
};

export type BookingQuote = {
  hall?: OnlineHallQuote;
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
  hall?: OnlineHallItem;
  hallItems?: OnlineHallItem[];
  serviceKind?: "accommodation" | "hall" | "combined";
  id: string;
  primaryName: string;
  createdAt: string;
  totalCentavos: number;
  reviewEligible?: boolean;
  financials?: import("./stay-changes.js").StayFinancials;
  items: {
    id: string;
    status?: string;
    checkedInAt?: string | null;
    checkedOutAt?: string | null;
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

export type OnlineHallInput = import("./function-hall.js").HallQuoteInput & {
  requests?: string;
};
export type OnlineHallQuote = {
  setup: "theater" | "room";
  attendees: number;
  minutes: number;
  start: string;
  end: string;
  protectedStart: string;
  protectedEnd: string;
  base: number;
  additional: number;
  total: number;
  settings: import("./function-hall.js").HallSettings;
  noticeReason: string | null;
};
export type OnlineHallItem = {
  id: string;
  setup: "theater" | "room";
  attendees: number;
  startAt: string;
  endAt: string;
  totalCentavos: number;
  originalCentavos?: number;
  refundDueCentavos?: number;
  refundedCentavos?: number;
  status: string;
  state: string;
  proofDeadlineAt: string;
  actualStart?: string | null;
  confirmationAt?: string | null;
};
