export type DataDomain =
  | "reservation"
  | "payment"
  | "stay"
  | "room"
  | "hall"
  | "catalog"
  | "settings"
  | "review"
  | "notification";
export const dataDomains: readonly DataDomain[];
export function writeDomain(
  method: string,
  path: string,
): DataDomain | undefined;
