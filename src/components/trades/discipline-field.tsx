import { useFormContext } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { DISCIPLINE_RULES } from "@/lib/trades/constants";
import type { TradeFormValues } from "@/lib/trades/schema";

export function DisciplineField() {
  const { setValue, watch } = useFormContext<TradeFormValues>();
  const items = (watch("discipline") as { rule: string; followed: boolean }[] | undefined) ?? [];

  const valueFor = (rule: string) =>
    items.find((i) => i.rule === rule)?.followed ?? false;

  const toggle = (rule: string, value: boolean) => {
    const others = items.filter((i) => i.rule !== rule);
    setValue("discipline", [...others, { rule, followed: value }], { shouldDirty: true });
  };

  return (
    <ul className="grid sm:grid-cols-2 gap-2.5">
      {DISCIPLINE_RULES.map((r) => {
        const checked = valueFor(r.key);
        return (
          <li
            key={r.key}
            className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3"
          >
            <Checkbox
              id={`d-${r.key}`}
              checked={checked}
              onCheckedChange={(v) => toggle(r.key, !!v)}
            />
            <label htmlFor={`d-${r.key}`} className="text-sm cursor-pointer flex-1">
              {r.key}
            </label>
            {!r.positive && (
              <span className="text-[10px] uppercase tracking-wide text-warning">flag</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
