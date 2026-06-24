import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, PlusCircle, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  usePlaybooks,
  useUpsertPlaybook,
  useDeletePlaybook,
  type PlaybookWithUsage,
} from "@/lib/playbooks/api";
import {
  playbookFormSchema,
  type PlaybookFormValues,
} from "@/lib/playbooks/schema";

export const Route = createFileRoute("/_app/playbooks")({
  component: PlaybooksPage,
});

function PlaybooksPage() {
  const { data: playbooks = [], isLoading } = usePlaybooks();
  const [editing, setEditing] = useState<PlaybookWithUsage | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlaybookWithUsage | null>(null);
  const deletePlaybook = useDeletePlaybook();

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (p: PlaybookWithUsage) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deletePlaybook.mutateAsync(confirmDelete.id);
      toast.success("Playbook deleted", {
        description:
          confirmDelete.trade_count > 0
            ? `${confirmDelete.trade_count} trade${confirmDelete.trade_count === 1 ? "" : "s"} untagged.`
            : undefined,
      });
      setConfirmDelete(null);
    } catch (err) {
      toast.error("Could not delete playbook", { description: (err as Error).message });
    }
  };

  return (
    <>
      <PageHeader
        title="Playbooks"
        description="Define named setups and tag your trades to track which strategies you actually run."
        action={
          <Button size="sm" onClick={openCreate}>
            <PlusCircle className="h-4 w-4 mr-2" />
            New playbook
          </Button>
        }
      />

      <SectionErrorBoundary title="Couldn't load your playbooks.">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : playbooks.length === 0 ? (
          <div className="surface-card p-10 text-center">
            <BookOpen className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <h3 className="text-sm font-medium mb-1">No playbooks yet</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Create your first setup — e.g. "Opening Range Breakout" or "VWAP Reclaim".
            </p>
            <Button size="sm" onClick={openCreate}>
              <PlusCircle className="h-4 w-4 mr-2" />
              New playbook
            </Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {playbooks.map((p) => (
              <div key={p.id} className="surface-card p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium truncate">{p.name}</h3>
                    <p className="text-[11px] text-muted-foreground">
                      {p.trade_count} trade{p.trade_count === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(p)}
                      aria-label="Edit playbook"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setConfirmDelete(p)}
                      aria-label="Delete playbook"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {p.description && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {p.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionErrorBoundary>

      <PlaybookFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this playbook?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete && confirmDelete.trade_count > 0
                ? `${confirmDelete.trade_count} trade${confirmDelete.trade_count === 1 ? "" : "s"} tagged with "${confirmDelete.name}" will be untagged. Trade history will be preserved.`
                : "This playbook has no trades tagged to it."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PlaybookFormDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: PlaybookWithUsage | null;
}) {
  const upsert = useUpsertPlaybook();
  const form = useForm<PlaybookFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(playbookFormSchema) as any,
    values: {
      name: initial?.name ?? "",
      description: initial?.description ?? "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await upsert.mutateAsync({ id: initial?.id, values: values as never });
      toast.success(initial ? "Playbook updated" : "Playbook created");
      onOpenChange(false);
      form.reset();
    } catch (err) {
      const message = (err as Error).message;
      const friendly = /duplicate key|unique/i.test(message)
        ? "You already have a playbook with that name."
        : message;
      toast.error("Could not save playbook", { description: friendly });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit playbook" : "New playbook"}</DialogTitle>
          <DialogDescription>
            Name your setup and add a short description of when you take it.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Opening Range Breakout"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={5}
                      placeholder="When does this setup trigger? What are the entry/exit conditions?"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={upsert.isPending}>
                {upsert.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {initial ? "Save changes" : "Create playbook"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
