import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { SESSION_NOTE_CATEGORIES } from "@/lib/workspace/constants";
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

export function QuickCaptureModal() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("observation");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user || !body.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("session_notes").insert({
      user_id: user.id,
      body: body.trim(),
      category,
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save note");
      return;
    }
    setBody("");
    setOpen(false);
    toast.success("Captured");
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          size="icon"
          className="md:hidden fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-lg z-40"
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
        <DrawerFooter>
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
