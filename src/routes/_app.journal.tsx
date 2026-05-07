import { createFileRoute } from "@tanstack/react-router";
import { format } from "date-fns";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/journal")({
  component: Journal,
});

function Journal() {
  const today = format(new Date(), "EEEE, d MMMM yyyy");
  return (
    <>
      <PageHeader title="Daily Journal" description={today} />
      <div className="surface-card p-6 md:p-8 space-y-6">
        <div>
          <h3 className="text-sm font-medium mb-3">How are you feeling?</h3>
          <div className="grid grid-cols-3 gap-3">
            {["Mood", "Energy", "Focus"].map((label) => (
              <div key={label} className="rounded-md border border-border bg-muted/30 p-4 text-center">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-lg font-medium mt-1">—</p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Pre-market notes</h3>
          <div className="h-24 rounded-md bg-muted/40" />
        </div>
        <div>
          <h3 className="text-sm font-medium mb-2">Post-market reflection</h3>
          <div className="h-24 rounded-md bg-muted/40" />
        </div>
      </div>
    </>
  );
}
