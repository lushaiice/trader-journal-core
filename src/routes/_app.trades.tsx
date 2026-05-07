import { createFileRoute, Link } from "@tanstack/react-router";
import { History, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/trades")({
  component: Trades,
});

function Trades() {
  return (
    <>
      <PageHeader
        title="Trade History"
        description="Every trade you've logged, with filters and search."
      />
      <EmptyState
        icon={History}
        title="No trades logged yet"
        description="Once you start journaling trades, they'll appear here in a clean, sortable table."
        action={
          <Button asChild size="sm">
            <Link to="/add-trade">
              <PlusCircle className="h-4 w-4 mr-2" /> Add your first trade
            </Link>
          </Button>
        }
      />
    </>
  );
}
