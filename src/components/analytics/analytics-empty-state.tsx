import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  icon: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  compact?: boolean;
}

export function AnalyticsEmptyState({ icon: Icon, title, description, className, compact }: Props) {
  return (
    <div
      className={cn(
        "surface-card flex flex-col items-center justify-center text-center px-6",
        compact ? "py-8" : "py-12 md:py-16",
        className,
      )}
    >
      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center mb-3">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium">{title}</h3>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-xs leading-relaxed">{description}</p>
      )}
    </div>
  );
}
