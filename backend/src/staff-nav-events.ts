import type { Express, RequestHandler, Response } from "express";

const queueWrites =
  /^\/(?:guest\/(?:payments\/[^/]+\/proof|cancellations|reschedules|hall\/[^/]+\/(?:cancel|reschedule))|staff\/(?:payment-reviews|rooms|walkins|check-ins|stays|stay-extensions|cancellations|reschedules|hall\/actions))(?:\/|$)/;
const streamsByApp = new WeakMap<Express, Set<Response>>();

export function closeStaffNavEvents(app: Express) {
  for (const stream of streamsByApp.get(app) ?? []) stream.end();
  streamsByApp.delete(app);
}

export function registerStaffNavEvents(app: Express, staff: RequestHandler) {
  const streams = new Set<Response>();
  streamsByApp.set(app, streams);

  app.get("/staff/dashboard/events", staff, (_req, res) => {
    if (!streamsByApp.has(app) || streams.size >= 100) {
      res.sendStatus(503);
      return;
    }
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    });
    streams.add(res);
    const keepalive = setInterval(() => {
      if (!res.writableNeedDrain) res.write(": keepalive\n\n");
    }, 15_000);
    // Recheck staff access on reconnect, including after an account is disabled.
    const expire = setTimeout(() => res.end(), 120_000);
    res.once("close", () => {
      clearInterval(keepalive);
      clearTimeout(expire);
      streams.delete(res);
    });
    res.write("data: refresh\n\n");
  });

  app.use((req, res, next) => {
    if (
      (req.method === "POST" || req.method === "PATCH") &&
      queueWrites.test(req.path) &&
      !req.path.endsWith("/quote")
    ) {
      res.once("finish", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        for (const stream of streams)
          if (!stream.writableEnded && !stream.writableNeedDrain)
            stream.write("data: refresh\n\n");
      });
    }
    next();
  });
}
