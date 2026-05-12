import { useState } from "react";
import { Banknote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCapitalState,
  useCreateCapitalEvent,
} from "@/hooks/capital";
import { CapitalEventDialog } from "./capital-event-dialog";

/**
 * Lightweight first-time onboarding prompt for setting starting capital.
 * Hidden once user has any capital event, or after dismissal in this session.
 */
export function FirstCapitalPrompt() {
  const { isLoading, events, hasInitialCapital } = useCapitalState();
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);
  const create = useCreateCapitalEvent();

  if (isLoading || hasInitialCapital || events.length > 0 || dismissed) return null;

  return (
    <>
      <div className="surface-card p-4 md:p-5 flex items-start gap-3 border border-primary/20">
        <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
          <Banknote className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Set your starting trading capital</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Anchor your analytics with a baseline. You can edit this later.
          </p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => setOpen(true)}>
              Set capital
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Skip for now
            </Button>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <CapitalEventDialog
        open={open}
        onOpenChange={setOpen}
        hasInitial={false}
        onSubmit={async (input) => {
          await create.mutateAsync({ ...input, eventType: "initial" });
        }}
      />
    </>
  );
}
