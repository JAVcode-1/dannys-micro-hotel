import type { DataDomain } from "@staytrack/shared/data-domains";

export function createInvalidationBatch(
  flush: (domains: DataDomain[]) => void,
  delay = 150,
) {
  const pending = new Set<DataDomain>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  return {
    add(domain: DataDomain) {
      if (disposed) return;
      pending.add(domain);
      timer ??= setTimeout(() => {
        timer = undefined;
        const domains = [...pending];
        pending.clear();
        flush(domains);
      }, delay);
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      pending.clear();
    },
  };
}
