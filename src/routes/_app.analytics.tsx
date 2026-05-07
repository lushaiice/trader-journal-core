import { createFileRoute } from "@tanstack/react-router";
import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export const Route = createFileRoute("/_app/analytics")({
  component: Analytics,
});

function Analytics() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Performance, behavior, and discipline insights — calmly visualized."
      />
      <EmptyState
        icon={BarChart3}
        title="Analytics will appear once you log trades"
        description="We'll surface win rate, R-multiples, drawdowns, and behavioral patterns here."
      />
    </>
  );
}
