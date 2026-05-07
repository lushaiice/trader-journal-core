import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
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
      <TradeForm />
    </>
  );
}
