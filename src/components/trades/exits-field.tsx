import { useFormContext, useFieldArray } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import type { TradeFormValues } from "@/lib/trades/schema";

export function ExitsField() {
  const { control } = useFormContext<TradeFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: "exits" });

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No exits yet. Add one when you partially or fully close this trade.
        </p>
      )}
      {fields.map((field, index) => (
        <div
          key={field.id}
          className="rounded-lg border border-border/70 bg-muted/30 p-3 md:p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Exit #{index + 1}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FormField
              control={control}
              name={`exits.${index}.exit_price`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Exit Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`exits.${index}.quantity`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`exits.${index}.exit_date`}
              render={({ field }) => (
                <FormItem className="col-span-2 md:col-span-2">
                  <FormLabel className="text-xs">Exit Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`exits.${index}.notes`}
              render={({ field }) => (
                <FormItem className="col-span-2 md:col-span-4">
                  <FormLabel className="text-xs">Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Reason for exit…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          append({
            exit_price: "" as unknown as number,
            quantity: "" as unknown as number,
            exit_date: new Date().toISOString().slice(0, 16),
            notes: "",
          })
        }
      >
        <Plus className="h-4 w-4 mr-1.5" /> Add exit
      </Button>
    </div>
  );
}
