import { z } from "zod";

export const playbookFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must be 80 characters or fewer"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export type PlaybookFormValues = z.input<typeof playbookFormSchema>;
export type PlaybookFormParsed = z.output<typeof playbookFormSchema>;
