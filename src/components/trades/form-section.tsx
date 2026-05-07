import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
}

export function FormSection({
  title,
  description,
  defaultOpen = true,
  collapsible = false,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="surface-card overflow-hidden">
      <header
        className={cn(
          "flex items-start justify-between gap-3 px-5 md:px-6 py-4 md:py-5 border-b border-border",
          collapsible && "cursor-pointer select-none",
        )}
        onClick={collapsible ? () => setOpen((o) => !o) : undefined}
      >
        <div>
          <h2 className="text-sm md:text-base font-semibold tracking-tight">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{description}</p>
          )}
        </div>
        {collapsible && (
          <ChevronDown
            className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        )}
      </header>
      {open && <div className="p-5 md:p-6">{children}</div>}
    </section>
  );
}
