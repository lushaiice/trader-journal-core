import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth-context";
import {
  fetchDailyReview,
  saveDailyReview,
  type DailyReview,
} from "@/services/workspace";
import {
  readLocalDraft,
  clearLocalDraft,
  useLocalDraft,
  useOnlineStatus,
  type SaveState,
} from "@/hooks/use-local-draft";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { SyncIndicator } from "@/components/sync-indicator";

const EMPTY: DailyReview = {
  did_well: "",
  mistakes: "",
  emotionally_disciplined: null,
  followed_plan: null,
  improve_tomorrow: "",
};

export function ReflectionEditor({ date = new Date() }: { date?: Date }) {
  const { user } = useAuth();
  const dateStr = format(date, "yyyy-MM-dd");
  const draftKey = `trader-os:reflection:${dateStr}`;
  const [state, setState] = useState<DailyReview>(EMPTY);
  const [status, setStatus] = useState<SaveState>("idle");
  const [loaded, setLoaded] = useState(false);
  const online = useOnlineStatus();

  // local-first restore
  useEffect(() => {
    const draft = readLocalDraft<DailyReview>(draftKey);
    if (draft) setState(draft);
  }, [draftKey]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const res = await fetchDailyReview(user.id, dateStr);
      if (!active) return;
      if (res.ok && res.data) {
        // server wins on initial hydration
        setState(res.data);
      }
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [user, dateStr]);

  // local draft autosave
  useLocalDraft(draftKey, state, loaded);

  // remote autosave
  useEffect(() => {
    if (!user || !loaded) return;
    setStatus("saving");
    const t = setTimeout(async () => {
      const res = await saveDailyReview(user.id, dateStr, state);
      if (res.ok) {
        setStatus("saved");
        clearLocalDraft(draftKey);
      } else {
        setStatus("error");
      }
    }, 700);
    return () => clearTimeout(t);
  }, [state, user, dateStr, loaded, draftKey]);

  const update = <K extends keyof DailyReview>(key: K, value: DailyReview[K]) =>
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
        <SyncIndicator state={status} online={online} />
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
