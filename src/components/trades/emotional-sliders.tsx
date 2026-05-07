import { useFormContext, Controller } from "react-hook-form";
import { Slider } from "@/components/ui/slider";
import { EMOTIONAL_QUESTIONS } from "@/lib/trades/constants";
import type { TradeFormValues } from "@/lib/trades/schema";

export function EmotionalSliders() {
  const { control } = useFormContext<TradeFormValues>();
  return (
    <div className="space-y-6">
      {EMOTIONAL_QUESTIONS.map((q) => (
        <Controller
          key={q.key}
          control={control}
          name={q.key as keyof TradeFormValues}
          render={({ field }) => {
            const value = Number(field.value) || 3;
            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm text-foreground/90">{q.label}</label>
                  <span className="text-xs font-medium tabular-nums text-primary bg-primary/10 px-2 py-0.5 rounded">
                    {value}/5
                  </span>
                </div>
                <Slider
                  min={1}
                  max={5}
                  step={1}
                  value={[value]}
                  onValueChange={(v) => field.onChange(v[0])}
                  className="transition-all"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                </div>
              </div>
            );
          }}
        />
      ))}
    </div>
  );
}
