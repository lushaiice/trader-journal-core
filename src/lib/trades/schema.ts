import { z } from "zod";

const positiveNum = z.coerce.number().positive("Must be > 0");
const nonNegNum = z.coerce.number().min(0, "Must be ≥ 0");
const optionalPositive = z
  .union([z.literal(""), z.coerce.number().positive("Must be > 0")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));
const score = z.coerce.number().int().min(1).max(5);

export const exitSchema = z.object({
  id: z.string().optional(),
  exit_price: positiveNum,
  quantity: positiveNum,
  exit_date: z.string().min(1, "Required"),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const disciplineSchema = z.object({
  rule: z.string(),
  followed: z.boolean(),
});

export const tradeFormSchema = z
  .object({
    symbol: z.string().trim().min(1, "Required").max(40).toUpperCase(),
    instrument_type: z.enum(["equity", "futures", "options"]),
    side: z.enum(["long", "short"]),
    entry_date: z.string().min(1, "Required"),

    planned_entry: optionalPositive,
    planned_stop_loss: optionalPositive,
    planned_target: optionalPositive,

    entry_price: positiveNum,
    quantity: positiveNum,

    exits: z.array(exitSchema).default([]),

    brokerage: nonNegNum.default(0),
    taxes: nonNegNum.default(0),
    other_fees: nonNegNum.default(0),

    confidence: score,
    emotion_level: score,
    recovery_urge: score,
    discipline_feel: score,
    setup_match: score,

    tags: z.array(z.string().min(1).max(40)).default([]),
    notes: z.string().max(4000).optional().or(z.literal("")),
    screenshot_url: z.string().url().optional().nullable(),

    discipline: z.array(disciplineSchema).default([]),
  })
  .superRefine((val, ctx) => {
    const sumQty = val.exits.reduce((a, e) => a + (Number(e.quantity) || 0), 0);
    if (sumQty > val.quantity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["exits"],
        message: `Total exit quantity (${sumQty}) exceeds entry quantity (${val.quantity})`,
      });
    }
  });

export type TradeFormValues = z.input<typeof tradeFormSchema>;
export type TradeFormParsed = z.output<typeof tradeFormSchema>;
