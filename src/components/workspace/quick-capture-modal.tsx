import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { SESSION_NOTE_CATEGORIES } from "@/lib/workspace/constants";
import { createNote } from "@/services/workspace";
import {
  readLocalDraft,
  clearLocalDraft,
  useLocalDraft,
} from "@/hooks/use-local-draft";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const DRAFT_KEY = "trader-os:quick-capture-draft:v1";

export function QuickCaptureModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("observation");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = readLocalDraft<{ body: string; category: string }>(DRAFT_KEY);
    if (d) {
      setBody(d.body);
      setCategory(d.category);
    }
  }, []);

  useLocalDraft(DRAFT_KEY, { body, category }, body.trim().length > 0);

  const save = async () => {
    if (!user || !body.trim()) return;
    setSaving(true);
    const res = await createNote(user.id, body.trim(), category);
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save — kept locally");
      return;
    }
    clearLocalDraft(DRAFT_KEY);
    setBody("");
    setOpen(false);
    toast.success("Captured");
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          size="icon"
          className="md:hidden fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 h-12 w-12 rounded-full shadow-lg z-40"
          aria-label="Quick capture"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Quick capture</DrawerTitle>
          <DrawerDescription>Log a thought before it slips.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 space-y-3">
          <Textarea
            autoFocus
            rows={4}
            placeholder="What just happened?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
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
        </div>
        <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button onClick={save} disabled={!body.trim() || saving}>
            Save
          </Button>
          <DrawerClose asChild>
            <Button variant="outline">Cancel</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
