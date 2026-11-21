export type PendingHallCommand = { path: string; payload: string; key: string };

export function hallCentavos(value: string) {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter a PHP amount with up to two decimal places.");
  const [pesos, fraction = ""] = value.split(".");
  const cents = BigInt(pesos) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("PHP amount is too large.");
  return Number(cents);
}

export function pendingHallCommand(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  token: string,
) {
  let subject = "";
  try {
    subject = JSON.parse(
      atob(token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")),
    ).sub;
  } catch {
    /* An invalid session cannot recover another actor's command. */
  }
  const key = "staytrack.hall.pending." + subject;
  return {
    load(): PendingHallCommand | undefined {
      if (!subject) return;
      try {
        const value = JSON.parse(storage.getItem(key) ?? "null");
        if (
          value &&
          /^actions\/[a-z_]+$/.test(value.path) &&
          typeof value.payload === "string" &&
          /^[A-Za-z0-9_-]{16,100}$/.test(value.key)
        )
          return value;
      } catch {
        /* Storage may be unavailable or contain an interrupted write. */
      }
    },
    save(value: PendingHallCommand) {
      if (subject) storage.setItem(key, JSON.stringify(value));
    },
    clear() {
      if (subject) storage.removeItem(key);
    },
  };
}
