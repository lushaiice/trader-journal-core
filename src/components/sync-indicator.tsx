import { Check, Loader2, AlertCircle, CloudOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SaveState } from "@/hooks/use-local-draft";

interface Props {
  state: SaveState;
  online?: boolean;
  className?: string;
}

export function SyncIndicator({ state, online = true, className }: Props) {
  if (!online) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <CloudOff className="h-3 w-3" />
        Offline · saved locally
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" /> Saving
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
          className,
        )}
      >
        <Check className="h-3 w-3 text-success" /> Saved
      </span>
    );
  }
  if (state === "error") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-xs text-warning",
          className,
        )}
      >
        <AlertCircle className="h-3 w-3" /> Retrying
      </span>
    );
  }
  return null;
}
