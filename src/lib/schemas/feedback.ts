import { z } from "zod";

export const feedbackSchema = z.object({
  category: z.enum(["bug", "idea", "friction", "other"]),
  message: z
    .string()
    .min(10, "Please add a bit more detail")
    .max(2000, "Message is too long"),
});

export type FeedbackFormValues = z.infer<typeof feedbackSchema>;
