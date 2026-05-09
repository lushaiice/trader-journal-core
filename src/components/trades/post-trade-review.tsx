import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Props {
  tradeId: string;
  initialReview?: string | null;
  initialLessons?: string | null;
}

export function PostTradeReview({ tradeId, initialReview, initialLessons }: Props) {
  const [review, setReview] = useState(initialReview ?? "");
  const [lessons, setLessons] = useState(initialLessons ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setReview(initialReview ?? "");
    setLessons(initialLessons ?? "");
    setHydrated(true);
  }, [initialReview, initialLessons, tradeId]);

  useEffect(() => {
    if (!hydrated) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      await supabase
        .from("trades")
        .update({ review_notes: review, lessons_learned: lessons })
        .eq("id", tradeId);
      setStatus("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [review, lessons, tradeId, hydrated]);

  return (
    <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium">Post-trade review</h4>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Add this after the dust settles. The honest version helps most.
          </p>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1.5">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving
            </>
          ) : status === "saved" ? (
            <>
              <Check className="h-3 w-3 text-success" /> Saved
            </>
          ) : null}
        </span>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Review</Label>
        <Textarea
          rows={3}
          placeholder="What actually happened on this trade?"
          value={review}
          onChange={(e) => setReview(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Lessons learned</Label>
        <Textarea
          rows={2}
          placeholder="One concrete lesson is enough."
          value={lessons}
          onChange={(e) => setLessons(e.target.value)}
        />
      </div>
    </div>
  );
}
