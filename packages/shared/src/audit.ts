export type AuditSubjectType =
  | "room"
  | "room_item"
  | "payment_submission"
  | "hall_reservation"
  | "review"
  | "feedback";
export type StaffAuditPage = {
  entries: {
    id: string;
    actorId: string;
    action: string;
    occurredAt: string;
    subjectType: AuditSubjectType | null;
    subjectId: string | null;
  }[];
  nextCursor: string | null;
};
