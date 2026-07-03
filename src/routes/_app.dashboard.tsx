import { createFileRoute, Link } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "@/components/analytics";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { useTradesQuery } from "@/lib/trades/api";
import { useCapitalState } from "@/hooks/capital";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const trades = useTradesQuery();
  const capital = useCapitalState();

  const hasTrades = (trades.data?.length ?? 0) > 0;
  const hasCapital = (capital.events?.length ?? 0) > 0;
  const hasReflection = (trades.data ?? []).some((t) =>
    Boolean(t.trade.review_notes || t.trade.lessons_learned),
  );
  const hasChecklist = false; // optimistic — surfaces until they hit /today

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Every trade, including the losers. Show the proof, not the promise."
        action={
          <Button asChild size="sm">
            <Link to="/add-trade">
              <PlusCircle className="h-4 w-4 mr-2" /> Add Trade
            </Link>
          </Button>
        }
      />
      <div className="space-y-6">
        <OnboardingChecklist
          hasCapital={hasCapital}
          hasTrades={hasTrades}
          hasReflection={hasReflection}
          hasChecklist={hasChecklist}
        />
        <SectionErrorBoundary
          title="Analytics temporarily unavailable."
          description="We had trouble loading your performance view. Try again in a moment."
        >
          <AnalyticsDashboard />
        </SectionErrorBoundary>
      </div>
    </>
  );
}
