import express from "express";
import type { HealthResponse } from "@staytrack/shared";

export const app = express();

app.get("/health", (_request, response) => {
  const body: HealthResponse = { status: "ok" };
  response.json(body);
});
