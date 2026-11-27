import { useEffect, useMemo, type ReactNode } from "react";
import { ApiScopeContext, apiQueryClient, clearApiScope } from "./api-query";

export default function PrivateDataScope({
  role,
  userId,
  accessTag,
  children,
}: {
  role: "staff" | "guest";
  userId: string | undefined;
  accessTag?: string;
  children: ReactNode;
}) {
  const scope = useMemo(
    () => (userId ? ([role, crypto.randomUUID()] as const) : undefined),
    [role, userId, accessTag],
  );
  useEffect(() => {
    if (scope) return () => clearApiScope(apiQueryClient, scope);
  }, [scope]);
  return (
    <ApiScopeContext.Provider value={scope}>
      {children}
    </ApiScopeContext.Provider>
  );
}
