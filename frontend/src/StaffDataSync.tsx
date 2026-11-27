import { useContext, useEffect, useState, type ReactNode } from "react";
import { dataDomains, type DataDomain } from "@staytrack/shared/data-domains";
import {
  ApiScopeContext,
  DataConnectionContext,
  apiQueryClient,
  invalidateApiDomains,
} from "./api-query";
import { createInvalidationBatch } from "./data-sync";
import { apiBase, guestAuth, isolatedDevelopment } from "./staff-auth";

let leavingChannel: Promise<unknown> = Promise.resolve();

export default function StaffDataSync({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const scope = useContext(ApiScopeContext);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "fallback"
  >("connecting");

  useEffect(() => {
    if (!scope || scope[0] !== "staff") return;
    const controller = new AbortController();
    const { signal } = controller;
    const batch = createInvalidationBatch((domains) => {
      void invalidateApiDomains(apiQueryClient, domains, scope);
    });
    const add = (domain: unknown) => {
      if (dataDomains.includes(domain as DataDomain))
        batch.add(domain as DataDomain);
    };
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    let channel:
      ReturnType<NonNullable<typeof guestAuth>["channel"]> | undefined;
    let reconnectDelay = 2_000;
    const connect = () => {
      if (signal.aborted) return;
      setConnection("live");
      reconnectDelay = 2_000;
      dataDomains.forEach(batch.add);
    };
    const disconnect = () => {
      if (!signal.aborted) setConnection("fallback");
    };

    async function listenLocally() {
      try {
        const response = await fetch(`${apiBase}/staff/dashboard/events`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal,
        });
        if (response.status === 401 || response.status === 403) {
          disconnect();
          return;
        }
        if (
          !response.ok ||
          !response.body ||
          !response.headers.get("content-type")?.startsWith("text/event-stream")
        )
          throw new Error("Staff synchronization unavailable.");
        const reader = response.body
          .pipeThrough(new TextDecoderStream())
          .getReader();
        let partial = "";
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done || signal.aborted) break;
            const lines = (partial + value).split("\n");
            partial = lines.pop() ?? "";
            for (const line of lines) {
              if (line === "data: connected") connect();
              else if (line.startsWith("data: ")) add(line.slice(6));
            }
          }
        } finally {
          await reader.cancel().catch(() => undefined);
        }
      } catch {
        // A bounded retry keeps the regular Express reads available.
      }
      if (signal.aborted) return;
      disconnect();
      reconnect = setTimeout(() => void listenLocally(), reconnectDelay);
      reconnectDelay = Math.min(30_000, reconnectDelay * 2);
    }

    async function start() {
      if (isolatedDevelopment) {
        void listenLocally();
        return;
      }
      const auth = guestAuth;
      if (!auth) {
        disconnect();
        return;
      }
      try {
        await leavingChannel;
        if (signal.aborted) return;
        await auth.realtime.setAuth();
        if (signal.aborted) return;
        channel = auth.channel("staytrack:staff", {
          config: { private: true },
        });
        channel
          .on("broadcast", { event: "invalidate" }, ({ payload }) =>
            add(payload?.domain),
          )
          .subscribe((status) => {
            if (signal.aborted) return;
            if (status === "SUBSCRIBED") connect();
            else {
              disconnect();
              if (status === "CLOSED" && reconnect === undefined) {
                reconnect = setTimeout(() => {
                  reconnect = undefined;
                  void start();
                }, reconnectDelay);
                reconnectDelay = Math.min(30_000, reconnectDelay * 2);
              }
            }
          });
      } catch {
        disconnect();
      }
    }

    // Defer the join so the development Strict Mode probe leaves no channel.
    const kickoff = setTimeout(() => void start(), 0);
    return () => {
      controller.abort();
      clearTimeout(kickoff);
      clearTimeout(reconnect);
      if (channel && guestAuth)
        leavingChannel = guestAuth
          .removeChannel(channel)
          .catch(() => undefined);
      batch.dispose();
    };
  }, [scope, token]);

  return (
    <DataConnectionContext.Provider value={connection}>
      {connection === "fallback" && (
        <p role="status" className="px-4 py-2 text-sm text-muted">
          Live updates are disconnected. Open queues refresh periodically and
          may be out of date.
        </p>
      )}
      {children}
    </DataConnectionContext.Provider>
  );
}
