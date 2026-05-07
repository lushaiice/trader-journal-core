import { useState, type KeyboardEvent } from "react";
import { useFormContext } from "react-hook-form";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PREDEFINED_TAGS } from "@/lib/trades/constants";
import type { TradeFormValues } from "@/lib/trades/schema";

export function TagsField() {
  const { setValue, watch } = useFormContext<TradeFormValues>();
  const tags = (watch("tags") as string[] | undefined) ?? [];
  const [draft, setDraft] = useState("");

  const toggle = (tag: string) => {
    setValue("tags", tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag], {
      shouldDirty: true,
    });
  };

  const addCustom = () => {
    const t = draft.trim();
    if (!t || tags.includes(t)) return;
    setValue("tags", [...tags, t], { shouldDirty: true });
    setDraft("");
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustom();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PREDEFINED_TAGS.map((tag) => {
          const active = tags.includes(tag);
          return (
            <button
              type="button"
              key={tag}
              onClick={() => toggle(tag)}
              className={cn(
                "text-xs rounded-full px-3 py-1.5 border transition-colors",
                active
                  ? "bg-primary/15 border-primary/40 text-primary"
                  : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:border-border/80",
              )}
            >
              {tag}
            </button>
          );
        })}
      </div>

      {tags.some((t) => !PREDEFINED_TAGS.includes(t as (typeof PREDEFINED_TAGS)[number])) && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Custom</p>
          <div className="flex flex-wrap gap-2">
            {tags
              .filter((t) => !PREDEFINED_TAGS.includes(t as (typeof PREDEFINED_TAGS)[number]))
              .map((t) => (
                <Badge key={t} variant="secondary" className="gap-1 pr-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    className="rounded hover:bg-background/40 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Add custom tag…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          maxLength={40}
        />
        <Button type="button" variant="outline" size="sm" onClick={addCustom}>
          Add
        </Button>
      </div>
    </div>
  );
}
