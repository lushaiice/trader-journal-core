import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ReviewState {
  did_well: string;
  mistakes: string;
  emotionally_disciplined: boolean | null;
  followed_plan: boolean | null;
  improve_tomorrow: string;
}

const EMPTY: ReviewState = {
  did_well: "",
  mistakes: "",
  emotionally_disciplined: null,
  followed_plan: null,
  improve_tomorrow: "",
};

export function ReflectionEditor({ date = new Date() }: { date?: Date }) {
  const { user } = useAuth();
  const dateStr = format(date, "yyyy-MM-dd");
  const [state, setState] = useState<ReviewState>(EMPTY);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("daily_reviews")
        .select("did_well,mistakes,emotionally_disciplined,followed_plan,improve_tomorrow")
        .eq("user_id", user.id)
        .eq("review_date", dateStr)
        .maybeSingle();
      if (data) {
        setState({
          did_well: data.did_well ?? "",
          mistakes: data.mistakes ?? "",
          emotionally_disciplined: data.emotionally_disciplined,
          followed_plan: data.followed_plan,
          improve_tomorrow: data.improve_tomorrow ?? "",
        });
      }
      setLoaded(true);
    })();
  }, [user, dateStr]);

  useEffect(() => {
    if (!user || !loaded) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      await supabase.from("daily_reviews").upsert(
        { user_id: user.id, review_date: dateStr, ...state },
        { onConflict: "user_id,review_date" },
      );
      setStatus("saved");
    }, 700);
    return () => clearTimeout(t);
  }, [state, user, dateStr, loaded]);

  const update = <K extends keyof ReviewState>(key: K, value: ReviewState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  return (
    <div className="surface-card p-5 md:p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium">End-of-day reflection</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A few minutes here compounds over months.
          </p>
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {status === "saving" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving
            </>
          ) : status === "saved" ? (
            <>
              <Check className="h-3 w-3 text-success" /> Saved
            </>
          ) : null}
        </div>
      </div>

      <Field label="What did I do well today?">
        <Textarea
          rows={3}
          value={state.did_well}
          onChange={(e) => update("did_well", e.target.value)}
          placeholder="Stayed patient on the open. Cut a loser without hesitating."
        />
      </Field>

      <Field label="What mistakes did I repeat?">
        <Textarea
          rows={3}
          value={state.mistakes}
          onChange={(e) => update("mistakes", e.target.value)}
          placeholder="Sized up after a winner. Skipped my checklist on the third trade."
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <ToggleRow
          label="Was I emotionally disciplined?"
          value={state.emotionally_disciplined}
          onChange={(v) => update("emotionally_disciplined", v)}
        />
        <ToggleRow
          label="Did I follow my plan?"
          value={state.followed_plan}
          onChange={(v) => update("followed_plan", v)}
        />
      </div>

      <Field label="What should improve tomorrow?">
        <Textarea
          rows={3}
          value={state.improve_tomorrow}
          onChange={(e) => update("improve_tomorrow", e.target.value)}
          placeholder="One thing. Keep it specific."
        />
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2.5">
      <span className="text-sm">{label}</span>
      <Switch checked={value === true} onCheckedChange={onChange} />
    </div>
  );
}
