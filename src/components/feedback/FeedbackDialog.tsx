import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  feedbackSchema,
  type FeedbackFormValues,
} from "@/lib/schemas/feedback";
import { submitFeedback } from "@/services/feedback";

interface FeedbackDialogProps {
  trigger: React.ReactNode;
}

export function FeedbackDialog({ trigger }: FeedbackDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: { category: undefined as unknown as FeedbackFormValues["category"], message: "" },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ category: undefined as unknown as FeedbackFormValues["category"], message: "" });
      setSubmitError(null);
      setSubmitted(false);
    }
  }, [open, form]);

  const onSubmit = async (values: FeedbackFormValues) => {
    setSubmitError(null);
    try {
      await submitFeedback({
        category: values.category,
        message: values.message,
        route_at_time: pathname,
      });
      setSubmitted(true);
      setTimeout(() => setOpen(false), 1500);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send feedback</DialogTitle>
          <DialogDescription>
            Tell us what's working, what's broken, or what feels off.
          </DialogDescription>
        </DialogHeader>

        {submitted ? (
          <p className="text-sm text-muted-foreground py-4">
            Feedback received — thank you.
          </p>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Category
                    </FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="What kind of feedback?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="friction">This felt clunky</SelectItem>
                        <SelectItem value="bug">Something's broken</SelectItem>
                        <SelectItem value="idea">I have an idea</SelectItem>
                        <SelectItem value="other">Something else</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-muted-foreground font-normal" />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-muted-foreground">
                      Message
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder="Describe it briefly..."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-muted-foreground font-normal" />
                  </FormItem>
                )}
              />

              {submitError && (
                <p className="text-xs text-muted-foreground">{submitError}</p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Send feedback
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
