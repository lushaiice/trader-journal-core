import { supabase } from "@/integrations/supabase/client";

export type FeedbackCategory = "bug" | "idea" | "friction" | "other";

export interface SubmitFeedbackInput {
  category: FeedbackCategory;
  message: string;
  route_at_time: string;
}

export class FeedbackSubmissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FeedbackSubmissionError";
  }
}

export async function submitFeedback(
  input: SubmitFeedbackInput,
): Promise<{ success: true }> {
  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  if (sessionError) {
    throw new FeedbackSubmissionError(sessionError.message);
  }
  const userId = sessionData.session?.user.id;
  if (!userId) {
    throw new FeedbackSubmissionError("You must be signed in to send feedback.");
  }

  const { error } = await supabase.from("feedback").insert({
    user_id: userId,
    category: input.category,
    message: input.message,
    route_at_time: input.route_at_time,
  });

  if (error) {
    throw new FeedbackSubmissionError(error.message);
  }

  return { success: true };
}
