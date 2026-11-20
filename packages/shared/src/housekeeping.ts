import type { RoomMaintenance } from "./maintenance.js";

export type HousekeepingAction = "start" | "finish" | "ready";
export type HousekeepingInput = {
  checkoutId: string;
  action: HousekeepingAction;
  requestKey: string;
  checksConfirmed?: boolean;
};
export type HousekeepingEvent = {
  action: HousekeepingAction;
  actorId: string;
  occurredAt: string;
};
export type StaffRoom = {
  id: string;
  code: string;
  category_code: string;
  category_name: string;
  operational_state: string;
  active: boolean;
  available_now: boolean;
  held_now: number;
  reserved_now: number;
  maintenance_now: boolean;
  turnover_until: string | null;
  checkout_id: string | null;
  housekeeping: HousekeepingEvent[];
  housekeeping_enabled: boolean;
  maintenance?: RoomMaintenance;
};
