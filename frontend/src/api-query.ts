import {
  QueryClient,
  useQuery,
  QueryClientContext,
  type QueryFilters,
} from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { writeDomain, type DataDomain } from "@staytrack/shared/data-domains";
import { apiBase } from "./staff-auth";

export type PrivateApiScope = readonly ["staff" | "guest", string];
type ApiScope = PrivateApiScope | readonly ["public"];
const publicScope = ["public"] as const;
const signedMediaLifetime = 115_000;
export const ApiScopeContext = createContext<PrivateApiScope | undefined>(
  undefined,
);
export const DataConnectionContext = createContext<
  "connecting" | "live" | "fallback"
>("fallback");

const roomWork = [
  "reservation",
  "payment",
  "stay",
  "room",
  "settings",
] as const;
const hallWork = ["hall", "reservation", "payment", "settings"] as const;
const minutes = 5 * 60_000;

function readPolicy(path: string): [number, readonly DataDomain[]] {
  if (/^\/(?:staff\/|guest\/)?catalog(?:\/|$)/.test(path))
    return [minutes, ["catalog", "settings"]];
  if (path === "/staff/settings" || path === "/guest/booking-status")
    return [minutes, ["settings", "catalog", "hall"]];
  if (path === "/staff/hall/settings") return [minutes, ["hall", "settings"]];
  if (path === "/staff/notifications") return [15_000, ["notification"]];
  if (
    /\/(?:payment-qr|payment-reviews|payments|refund-issues)(?:\/|$)/.test(path)
  )
    return [5_000, ["payment", "reservation", "hall", "stay"]];
  if (/\/(?:rooms|stays|check-ins)(?:\/|$)/.test(path))
    return [10_000, roomWork];
  if (/\/(?:hall|hall-status)(?:\/|$)/.test(path))
    return [path.includes("reports") ? 60_000 : 10_000, hallWork];
  if (path === "/staff/dashboard") return [15_000, [...roomWork, "hall"]];
  if (/\/(?:analytics|audit)(?:\/|$)/.test(path))
    return [60_000, [...roomWork, "hall", "catalog", "review"]];
  if (/\/(?:reviews|private-feedback)(?:\/|$)/.test(path))
    return [60_000, ["review"]];
  return [15_000, [...roomWork, "hall"]];
}

export class ApiReadError extends Error {
  constructor(
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `Data request failed (${status})`);
  }
}

export function createApiQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: minutes,
        retry: (failures, error) =>
          failures < 1 &&
          (!(error instanceof ApiReadError) || error.status >= 500),
        retryDelay: 400,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
export const apiQueryClient = createApiQueryClient();

export async function apiRead<T>(
  path: string,
  token: string | undefined,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(apiBase + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    cache: "no-store",
    signal,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiReadError(
      response.status,
      typeof body?.error === "string" ? body.error : undefined,
    );
  }
  return response.json() as Promise<T>;
}

export function apiQueryOptions<T>(
  path: string,
  token: string | undefined,
  scope: ApiScope,
) {
  const [route] = path.split("?");
  const [staleTime] = readPolicy(route);
  return {
    queryKey: ["api", ...scope, path] as const,
    queryFn: ({ signal }: { signal: AbortSignal }) =>
      apiRead<T>(path, token, signal),
    staleTime,
  };
}

export function useApiReadOptions<T>(
  path: string | null,
  token?: string,
  options: { live?: boolean; clock?: boolean; signedMedia?: boolean } = {},
) {
  const scope = useContext(ApiScopeContext);
  const client = useContext(QueryClientContext) ?? apiQueryClient;
  const connection = useContext(DataConnectionContext);
  const staffRead = path?.startsWith("/staff/") === true;
  const privateRead = !!token || staffRead;
  // Standalone previews and component tests have no verified session provider.
  const standalone = useMemo<PrivateApiScope | undefined>(
    () =>
      !scope && privateRead
        ? [staffRead ? "staff" : "guest", crypto.randomUUID()]
        : undefined,
    [scope, privateRead, staffRead, token],
  );
  useEffect(() => {
    if (standalone) return () => clearApiScope(client, standalone);
  }, [client, standalone]);
  const readOptions = apiQueryOptions<T>(
    path ?? "",
    token,
    privateRead ? (scope ?? standalone!) : publicScope,
  );
  return {
    client,
    options: {
      ...readOptions,
      enabled: path !== null,
      ...(options.signedMedia ? { gcTime: 0, staleTime: 0 } : {}),
      refetchInterval:
        options.live && (connection !== "live" || !privateRead)
          ? Math.max(30_000, readOptions.staleTime)
          : options.clock
            ? 60_000
            : (false as const),
    },
  };
}

export function accessDenied(error: unknown) {
  return (
    error instanceof ApiReadError && [401, 403, 404].includes(error.status)
  );
}

export function useApiQuery<T>(
  path: string | null,
  token?: string,
  options?: Parameters<typeof useApiReadOptions>[2],
) {
  const read = useApiReadOptions<T>(path, token, options);
  const query = useQuery(read.options, read.client);
  return {
    get data() {
      return accessDenied(query.error) ? undefined : query.data;
    },
    get dataUpdatedAt() {
      return query.dataUpdatedAt;
    },
    get error() {
      return query.error;
    },
    get isError() {
      return query.isError;
    },
    get isPending() {
      return query.isPending;
    },
    refetch: query.refetch,
  };
}

export function useCurrentSignedMedia(
  url: string | null | undefined,
  receivedAt: number,
) {
  const [expired, setExpired] = useState(0);
  useEffect(() => {
    if (!url || !receivedAt) return;
    const timer = setTimeout(
      () => setExpired(receivedAt),
      Math.max(0, receivedAt + signedMediaLifetime - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [url, receivedAt]);
  return url &&
    receivedAt > expired &&
    receivedAt + signedMediaLifetime > Date.now()
    ? url
    : null;
}

export function clearApiScope(client: QueryClient, scope: PrivateApiScope) {
  client.removeQueries({ queryKey: ["api", ...scope] });
}

export async function invalidateApiDomains(
  client: QueryClient,
  domains: readonly DataDomain[],
  scope?: ApiScope,
) {
  const filters = {
    queryKey: scope ? ["api", ...scope] : ["api"],
    predicate: (query) => {
      const path = query.queryKey.at(-1);
      return (
        typeof path === "string" &&
        readPolicy(path.split("?")[0])[1].some((domain) =>
          domains.includes(domain),
        )
      );
    },
  } satisfies QueryFilters;
  const initialReads: QueryFilters = {
    queryKey: filters.queryKey,
    fetchStatus: "fetching",
    predicate: (query) =>
      query.state.data === undefined && filters.predicate(query),
  };
  // The query library reuses an in-flight initial read unless it is cancelled explicitly.
  if (client.isFetching(initialReads)) await client.cancelQueries(initialReads);
  return client.invalidateQueries(filters);
}

// Commands keep their existing validation, response handling and idempotency.
export async function writeApi(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const domain = writeDomain(init.method ?? "", url.slice(apiBase.length));
  if (response.ok && domain)
    void invalidateApiDomains(apiQueryClient, [domain]);
  return response;
}
