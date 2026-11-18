import { expireClaims } from "../backend/dist/claim-holds.js";
import { closeDatabase } from "../backend/dist/database.js";

try {
  const count = await expireClaims(Date.now());
  process.stdout.write(`Expired ${count} holds\n`);
} finally {
  await closeDatabase();
}
