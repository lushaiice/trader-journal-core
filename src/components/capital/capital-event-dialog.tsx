import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type {
  CapitalEvent,
  CapitalEventInput,
  CapitalEventType,
} from "@/types/capital";

const schema = z.object({
  eventType: z.enum(["initial", "deposit", "withdrawal"]),
  amount: z.coerce.number().positive("Amount must be greater than 0"),
  eventDate: z.string().min(1, "Date is required"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: CapitalEvent | null;
  hasInitial: boolean;
  onSubmit: (input: CapitalEventInput) => Promise<void>;
  /** When true, show a warning that historical analytics will recalculate. */
  isHistoricalEdit?: boolean;
}

const TYPES: { value: CapitalEventType; label: string; icon: typeof Banknote }[] = [
  { value: "initial", label: "Initial capital", icon: Banknote },
  { value: "deposit", label: "Deposit", icon: ArrowDownLeft },
  { value: "withdrawal", label: "Withdrawal", icon: ArrowUpRight },
];

export function CapitalEventDialog({
  open,
  onOpenChange,
  initial,
  hasInitial,
  onSubmit,
  isHistoricalEdit,
}: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [submitting, setSubmitting] = useState(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: initial
      ? {
          eventType: initial.eventType,
          amount: initial.amount,
          eventDate: initial.eventDate,
          notes: initial.notes ?? "",
        }
      : {
          eventType: hasInitial ? "deposit" : "initial",
          amount: 0,
          eventDate: today,
          notes: "",
        },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      await onSubmit({
        eventType: values.eventType,
        amount: values.amount,
        eventDate: values.eventDate,
        notes: values.notes?.trim() ? values.notes.trim() : null,
      });
      onOpenChange(false);
      form.reset();
    } finally {
      setSubmitting(false);
    }
  });

  const eventType = form.watch("eventType");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit capital event" : "Add capital event"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Capital events shape the equity baseline. They are excluded from trading
            performance.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TYPES.map((t) => {
              const active = eventType === t.value;
              const disabled = t.value === "initial" && hasInitial && initial?.eventType !== "initial";
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  type="button"
                  disabled={disabled}
                  onClick={() => form.setValue("eventType", t.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-md border px-2 py-3 text-[11px] transition-colors",
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount (₹)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                {...form.register("amount", { valueAsNumber: true })}
              />
              {form.formState.errors.amount && (
                <p className="text-[11px] text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input type="date" {...form.register("eventDate")} max={today} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              rows={2}
              placeholder="e.g. Added funds after salary"
              {...form.register("notes")}
            />
          </div>

          {isHistoricalEdit && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[11px] text-amber-700 dark:text-amber-300">
              Changing this event will recalculate portfolio analytics.
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : initial ? "Save changes" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Suppress unused-import false positive in some TS configs.
void Select;
void SelectContent;
void SelectItem;
void SelectTrigger;
void SelectValue;
