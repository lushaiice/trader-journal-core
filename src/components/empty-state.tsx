import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="surface-card flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h3 className="text-base font-medium">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
