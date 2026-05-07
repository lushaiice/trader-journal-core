import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "@/components/analytics";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A calm overview of your performance, behavior, and discipline."
        action={
          <Button asChild size="sm">
            <Link to="/add-trade">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Trade
            </Link>
          </Button>
        }
      />
      <AnalyticsDashboard />
    </>
  );
}
