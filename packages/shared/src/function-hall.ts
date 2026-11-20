export type HallSetup = "theater" | "room";
export type HallChannel = "walk_in" | "telephone" | "messenger";
export type HallQuoteInput = {
  setup: HallSetup;
  attendees: number;
  start: string;
  minutes: number;
  noticeReason?: string;
};
export type HallSettings = {
  opening: number;
  closing: number;
  notice: number;
  horizon: number;
  preparation: number;
  cleanup: number;
  noShowGrace: number;
  reminder: number;
};
