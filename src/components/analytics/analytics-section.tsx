import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function AnalyticsSection({ title, description, action, children, className }: Props) {
  return (
    <section className={cn("space-y-3 md:space-y-4", className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-base md:text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
