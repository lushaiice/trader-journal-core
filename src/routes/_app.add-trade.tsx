import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";

export const Route = createFileRoute("/_app/add-trade")({
  component: AddTrade,
});

function AddTrade() {
  return (
    <>
      <PageHeader
        title="Add Trade"
        description="Log a new trade entry. The full form will go here."
      />
      <div className="surface-card p-6 md:p-8">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-10 rounded-md bg-muted/60" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-10 rounded-md bg-muted/60" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-10 rounded-md bg-muted/60" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-10 rounded-md bg-muted/60" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="h-24 rounded-md bg-muted/60" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-6">
          Trade entry form scaffolding — fields will be wired up next.
        </p>
      </div>
    </>
  );
}
