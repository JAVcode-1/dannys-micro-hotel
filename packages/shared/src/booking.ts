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
  items: {
    id: string;
    category: string;
    startAt: string;
    endAt: string;
    adults: number;
    children: number;
    totalCentavos: number;
    state: string;
    proofDeadlineAt: string;
  }[];
};
