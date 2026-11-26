import type { ReactNode } from "react";

export default function StaffLoadingSkeleton({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse">
        {children}
      </div>
    </div>
  );
}

export function SkeletonBlock({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block max-w-full rounded-md bg-subtle ${className}`}
    />
  );
}

export function SkeletonField() {
  return (
    <div className="min-w-0 space-y-2">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="h-11 w-full" />
    </div>
  );
}
