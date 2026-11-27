import { afterEach } from "node:test";

afterEach(async () => {
  const { apiQueryClient } = await import("../src/api-query.ts");
  apiQueryClient.clear();
});
