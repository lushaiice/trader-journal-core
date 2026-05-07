import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { AnalyticsDashboard } from "@/components/analytics";

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
      <AnalyticsDashboard />
    </>
  );
}
