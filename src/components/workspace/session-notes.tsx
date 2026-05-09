import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SESSION_NOTE_CATEGORIES } from "@/lib/workspace/constants";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Note {
  id: string;
  body: string;
  category: string;
  note_at: string;
}

export function SessionNotes() {
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("observation");

  const load = async () => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");
    const { data } = await supabase
      .from("session_notes")
      .select("id,body,category,note_at")
      .eq("user_id", user.id)
      .gte("note_at", `${today}T00:00:00`)
      .order("note_at", { ascending: false });
    setNotes(data ?? []);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const add = async () => {
    if (!user || !body.trim()) return;
    await supabase.from("session_notes").insert({
      user_id: user.id,
      body: body.trim(),
      category,
    });
    setBody("");
    void load();
  };

  const remove = async (id: string) => {
    await supabase.from("session_notes").delete().eq("id", id);
    void load();
  };

  return (
    <div className="surface-card p-5 md:p-6 space-y-4">
      <div>
        <h3 className="font-medium">Session notes</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quick observations during the session.
        </p>
      </div>

      <div className="space-y-2">
        <Textarea
          rows={2}
          placeholder="Note an observation, an emotion, or a setup…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_NOTE_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={add} disabled={!body.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Log
          </Button>
        </div>
      </div>

      <ul className="space-y-1.5">
        {notes.map((n) => (
          <li
            key={n.id}
            className="rounded-md border border-border bg-muted/20 px-3 py-2 flex gap-3 items-start"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {n.category}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(n.note_at), "HH:mm")}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{n.body}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(n.id)}>
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </li>
        ))}
        {!notes.length && (
          <li className="text-xs text-muted-foreground py-4 text-center">
            No notes yet. The first one is the hardest.
          </li>
        )}
      </ul>
    </div>
  );
}
