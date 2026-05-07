import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { tradeFormSchema, type TradeFormValues } from "@/lib/trades/schema";
import { ASSET_TYPES, DIRECTIONS, DISCIPLINE_RULES } from "@/lib/trades/constants";
import { useSaveTrade, type TradeWithRelations } from "@/lib/trades/api";
import {
  clearTradeDraft,
  loadTradeDraft,
  useTradeDraftAutosave,
} from "@/hooks/trades/use-trade-draft";
import { FormSection } from "./form-section";
import { ExitsField } from "./exits-field";
import { EmotionalSliders } from "./emotional-sliders";
import { TagsField } from "./tags-field";
import { DisciplineField } from "./discipline-field";
import { ScreenshotField } from "./screenshot-field";

interface TradeFormProps {
  initial?: TradeWithRelations;
  onSaved?: (id: string) => void;
}

function buildDefaults(initial?: TradeWithRelations): TradeFormValues {
  const t = initial?.trade;
  return {
    symbol: t?.symbol ?? "",
    instrument_type: (t?.instrument_type as "equity" | "futures" | "options") ?? "equity",
    side: (t?.side as "long" | "short") ?? "long",
    entry_date: t?.entry_date
      ? new Date(t.entry_date).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    planned_entry: (t?.planned_entry ?? "") as unknown as number,
    planned_stop_loss: (t?.planned_stop_loss ?? "") as unknown as number,
    planned_target: (t?.planned_target ?? "") as unknown as number,
    entry_price: (t?.entry_price ?? "") as unknown as number,
    quantity: (t?.quantity ?? "") as unknown as number,
    exits:
      initial?.exits.map((e) => ({
        id: e.id,
        exit_price: Number(e.exit_price),
        quantity: Number(e.quantity),
        exit_date: new Date(e.exit_date).toISOString().slice(0, 16),
        notes: e.notes ?? "",
      })) ?? [],
    brokerage: Number(t?.brokerage ?? 0),
    taxes: Number(t?.taxes ?? 0),
    other_fees: Number(t?.other_fees ?? 0),
    confidence: t?.confidence ?? 3,
    emotion_level: t?.emotion_level ?? 3,
    recovery_urge: t?.recovery_urge ?? 3,
    discipline_feel: t?.discipline_feel ?? 3,
    setup_match: t?.setup_match ?? 3,
    tags: (t?.tags as string[] | null) ?? [],
    notes: t?.notes ?? "",
    screenshot_url: t?.screenshot_url ?? null,
    discipline:
      initial?.discipline.map((d) => ({ rule: d.rule, followed: d.followed })) ??
      DISCIPLINE_RULES.map((r) => ({ rule: r.key, followed: r.positive })),
  };
}

export function TradeForm({ initial, onSaved }: TradeFormProps) {
  const navigate = useNavigate();
  const save = useSaveTrade(initial?.trade.id);
  const isNew = !initial;

  const methods = useForm<TradeFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(tradeFormSchema) as any,
    defaultValues: buildDefaults(initial),
    mode: "onBlur",
  });

  // Restore local draft for new trades.
  useEffect(() => {
    if (!isNew) return;
    const draft = loadTradeDraft();
    if (draft) {
      methods.reset(draft);
      toast.message("Draft restored", { description: "Picked up where you left off." });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initial) methods.reset(buildDefaults(initial));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial?.trade.id]);

  // Autosave draft while creating a new trade.
  useTradeDraftAutosave(isNew);

  const onSubmit = methods.handleSubmit(async (values) => {
    try {
      const id = await save.mutateAsync(values as never);
      if (isNew) clearTradeDraft();
      toast.success(initial ? "Trade updated" : "Trade saved");
      if (onSaved) onSaved(id);
      else navigate({ to: "/trades" });
    } catch (err) {
      toast.error("Could not save trade", { description: (err as Error).message });
    }
  });

  return (
    <FormProvider {...methods}>
      <form onSubmit={onSubmit} className="space-y-5 pb-28 md:pb-0">
        {/* Basic */}
        <FormSection title="Trade Basics" description="What did you trade and when?">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={methods.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="RELIANCE" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={methods.control}
              name="entry_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trade Date</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={methods.control}
              name="instrument_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asset Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ASSET_TYPES.map((a) => (
                        <SelectItem key={a.value} value={a.value}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={methods.control}
              name="side"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Direction</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIRECTIONS.map((d) => (
                        <SelectItem key={d.value} value={d.value}>
                          {d.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Planned */}
        <FormSection
          title="Planned Trade"
          description="Optional. Track your plan vs actual execution."
          collapsible
        >
          <div className="grid sm:grid-cols-3 gap-4">
            {(["planned_entry", "planned_stop_loss", "planned_target"] as const).map((name) => (
              <FormField
                key={name}
                control={methods.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">
                      {name.replace("planned_", "").replace("_", " ")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="0.00"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </FormSection>

        {/* Actual */}
        <FormSection title="Actual Entry" description="The position you actually took.">
          <div className="grid sm:grid-cols-2 gap-4">
            <FormField
              control={methods.control}
              name="entry_price"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Entry Price</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={methods.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" step="any" inputMode="decimal" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        {/* Exits */}
        <FormSection title="Exits" description="Add partial or full exits as you scale out.">
          <ExitsField />
          {methods.formState.errors.exits?.message && (
            <p className="text-xs text-destructive mt-3">
              {methods.formState.errors.exits.message as string}
            </p>
          )}
        </FormSection>

        {/* Costs */}
        <FormSection title="Costs" description="All fees in INR." collapsible>
          <div className="grid sm:grid-cols-3 gap-4">
            {(["brokerage", "taxes", "other_fees"] as const).map((name) => (
              <FormField
                key={name}
                control={methods.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="capitalize">{name.replace("_", " ")}</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" inputMode="decimal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </FormSection>

        {/* Emotional */}
        <FormSection
          title="Emotional Check-in"
          description="Honest self-rating, 1 (low) to 5 (high)."
        >
          <EmotionalSliders />
        </FormSection>

        {/* Tags */}
        <FormSection title="Setup Tags" description="Tag the strategy or context." collapsible>
          <TagsField />
        </FormSection>

        {/* Discipline */}
        <FormSection title="Discipline Check" description="Rate how you behaved on this trade.">
          <DisciplineField />
        </FormSection>

        {/* Screenshot */}
        <FormSection title="Chart Screenshot" description="Optional reference image." collapsible>
          <ScreenshotField />
        </FormSection>

        {/* Notes */}
        <FormSection title="Trade Notes" description="Anything else worth remembering." collapsible>
          <FormField
            control={methods.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    rows={6}
                    placeholder="What worked, what didn't, what you noticed about yourself…"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        {/* Desktop save */}
        <div className="hidden md:flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/trades" })}>
            Cancel
          </Button>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initial ? "Update Trade" : "Save Trade"}
          </Button>
        </div>

        {/* Mobile sticky save */}
        <div className="md:hidden fixed left-0 right-0 bottom-14 z-40 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] bg-gradient-to-t from-background via-background to-background/0 border-t border-border">
          <Button type="submit" className="w-full h-11" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initial ? "Update Trade" : "Save Trade"}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
