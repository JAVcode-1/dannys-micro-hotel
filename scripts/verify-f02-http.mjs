import assert from "node:assert/strict";
import { app } from "../backend/dist/app.js";
import { closeDatabase } from "../backend/dist/database.js";

const server = app.listen(0);
try {
  const { port } = server.address();
  for (const path of ["health", "ready"]) {
    const response = await fetch(`http://127.0.0.1:${port}/${path}`);
    assert.equal(response.status, 200, `/${path}`);
    console.log(`/${path}: HTTP ${response.status}`);
  }
} finally {
  server.close();
  await closeDatabase();
}
