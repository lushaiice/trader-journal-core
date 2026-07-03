import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { AnalyticsDashboard } from "@/components/analytics";
import { SectionErrorBoundary } from "@/components/section-error-boundary";

export const Route = createFileRoute("/_app/analytics")({
  component: Analytics,
});

function Analytics() {
  return (
    <>
      <PageHeader
        title="Analytics"
        description="Performance, behavior, and discipline — evidence over adjectives."
      />
      <SectionErrorBoundary
        title="Analytics temporarily unavailable."
        description="We had trouble loading this view. Try again in a moment."
      >
        <AnalyticsDashboard />
      </SectionErrorBoundary>
    </>
  );
}
