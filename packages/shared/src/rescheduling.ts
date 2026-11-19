export type RescheduleInput = {
  requestKey: string;
  expectedRevision: number;
  startAt: string;
  endAt: string;
  blocks: number[];
  reason: string;
};
export type RescheduleDecisionInput = {
  requestKey: string;
  expectedRevision: number;
  approved: boolean;
  reason: string;
};
export type RescheduleEligibility =
  | "eligible"
  | "walk_in_policy_pending"
  | "extra_bed_policy_pending"
  | "financial_policy_pending";
export type RescheduleRecord = {
  id: string;
  roomBookingId: string;
  expectedRevision: number;
  originalStartAt: string;
  originalEndAt: string;
  requestedStartAt: string;
  requestedEndAt: string;
  eligibility: RescheduleEligibility;
  approved: boolean | null;
  originalCentavos: number;
  proposalDeltaCentavos: number | null;
  proposalStatus: "policy_pending" | null;
  confirmationAt: string | null;
  cancellationDeadlineAt: string | null;
  currentStartAt: string;
  currentEndAt: string;
  currentRevision: number;
  blocks: number[];
  originalBlocks: number[];
  reason: string;
  blocker: string | null;
  canApprove: boolean;
};
export type RescheduleSnapshot = {
  channel: "online" | "walk_in";
  startAt: string;
  endAt: string;
  blocks: number[];
  totalCentavos: number;
  extraBedCentavos: number;
};
