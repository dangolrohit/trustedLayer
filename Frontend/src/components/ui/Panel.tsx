import type { HTMLAttributes } from "react";

import { cn } from "../../lib/utils";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section
      className={cn("rounded-lg border border-border bg-white p-4 shadow-sm sm:p-5", className)}
      {...props}
    />
  );
}

export function StatPanel({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string | number;
  detail?: string;
  className?: string;
}) {
  return (
    <Panel className={cn("min-h-28", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      {detail ? <p className="mt-1 text-sm text-muted-foreground">{detail}</p> : null}
    </Panel>
  );
}
