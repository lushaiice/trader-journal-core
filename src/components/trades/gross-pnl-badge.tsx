import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Charges {
  brokerage: number | string | null | undefined;
  taxes: number | string | null | undefined;
  other_fees: number | string | null | undefined;
}

/** True for csv-imported trades that have no charges entered yet. */
export function isGrossOnly(source: string | null | undefined, charges: Charges): boolean {
  if (source !== "csv_import") return false;
  const total =
    (Number(charges.brokerage) || 0) +
    (Number(charges.taxes) || 0) +
    (Number(charges.other_fees) || 0);
  return total === 0;
}

/**
 * Small, calm badge for imported trades whose P&L is still gross-only.
 * Disappears automatically once any charges are added.
 */
export function GrossPnlBadge({
  source,
  brokerage,
  taxes,
  other_fees,
  className,
}: {
  source?: string | null;
  brokerage?: number | string | null;
  taxes?: number | string | null;
  other_fees?: number | string | null;
  className?: string;
}) {
  if (!isGrossOnly(source, { brokerage, taxes, other_fees })) return null;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={
              "gap-1 text-[10px] font-medium text-muted-foreground border-dashed " +
              (className ?? "")
            }
            data-testid="gross-pnl-badge"
          >
            <Info className="h-3 w-3" />
            Gross P&amp;L
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          P&amp;L shown is before brokerage and taxes. Add charges to this trade to see net.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
