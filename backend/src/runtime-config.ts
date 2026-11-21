import type { PoolConfig } from "pg";

export function assertIsolatedTarget(
  options: PoolConfig,
  mode = process.env.NODE_ENV,
) {
  if (
    !["test", "development"].includes(mode ?? "") ||
    !["localhost", "127.0.0.1", "::1"].includes(options.host ?? "") ||
    options.database !== "staytrack_test" ||
    options.connectionString
  ) {
    throw new Error(
      "Enabled workflows require an isolated loopback staytrack_test database in test/development mode.",
    );
  }
}

export function proxyTrust(value: string | undefined) {
  if (!value) return false;
  const entries = value.split(",").map((entry) => entry.trim());
  if (
    entries.some(
      (entry) =>
        !entry ||
        !/^(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{1,2})?$|^(?:[a-fA-F0-9]*:){2,}[a-fA-F0-9]*(?:\/\d{1,3})?$/.test(
          entry,
        ),
    )
  )
    throw new Error(
      "TRUSTED_PROXY_CIDRS must contain explicit proxy IP addresses or CIDRs.",
    );
  return entries;
}
