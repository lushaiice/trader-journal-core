import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { TradeForm } from "@/components/trades/trade-form";

export const Route = createFileRoute("/_app/add-trade")({
  component: AddTrade,
});

function AddTrade() {
  return (
    <>
      <PageHeader
        title="Add Trade"
        description="Log a trade with full context — plan, execution, emotion, discipline."
      />
      <SectionErrorBoundary
        title="The trade form had trouble loading."
        description="Your draft is still safe locally. Try again in a moment."
      >
        <TradeForm />
      </SectionErrorBoundary>
    </>
  );
}
