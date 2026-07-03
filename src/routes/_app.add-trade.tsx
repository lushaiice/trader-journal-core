import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { TradeForm } from "@/components/trades/trade-form";
import { ImportTradesDialog } from "@/components/trades/import-trades-dialog";

export const Route = createFileRoute("/_app/add-trade")({
  component: AddTrade,
});

function AddTrade() {
  const [importOpen, setImportOpen] = useState(false);

  return (
    <>
      <PageHeader
        title="Add Trade"
        description="Log a trade with full context — plan, execution, emotion, discipline."
        action={
          <button
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Upload className="h-4 w-4" />
            Import from broker instead
          </button>
        }
      />
      <SectionErrorBoundary
        title="The trade form had trouble loading."
        description="Your draft is still safe locally. Try again in a moment."
      >
        <TradeForm />
      </SectionErrorBoundary>
      <ImportTradesDialog open={importOpen} onOpenChange={setImportOpen} />
    </>
  );
}
