import express from "express";
import type { HealthResponse } from "@staytrack/shared";
import { probeDatabase } from "./database.js";

export function createApp(databaseProbe: () => Promise<void> = probeDatabase) {
  const app = express();
  let lastProbe: Promise<void> | undefined;
  let lastProbeAt = 0;
  let probeInFlight = false;

  app.get("/health", (_request, response) => {
    const body: HealthResponse = { status: "ok" };
    response.json(body);
  });

  app.get("/ready", async (_request, response) => {
    try {
      if (
        !lastProbe ||
        (!probeInFlight && performance.now() - lastProbeAt >= 5000)
      ) {
        lastProbeAt = performance.now();
        probeInFlight = true;
        const current = Promise.resolve().then(databaseProbe);
        lastProbe = current;
        void current.then(
          () => {
            if (lastProbe === current) probeInFlight = false;
          },
          () => {
            if (lastProbe === current) {
              probeInFlight = false;
            }
          },
        );
      }
      await lastProbe;
      response.json({ status: "ready" });
    } catch {
      response.status(503).json({ status: "unavailable" });
    }
  });
  return app;
}

export const app = createApp();
