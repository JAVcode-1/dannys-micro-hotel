export type MaintenanceAction = "open" | "progress" | "clear";

export type RoomMaintenance = {
  enabled: boolean;
  activeBlockId: string | null;
  events: {
    id: string;
    blockId: string;
    action: MaintenanceAction;
    note: string;
    actorId: string;
    occurredAt: string;
  }[];
  affected: {
    itemId: string;
    startAt: string;
    endAt: string;
    state: string;
    paid: boolean;
  }[];
};
