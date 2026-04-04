import { z } from "zod";

export const acceptanceEvaluationSchema = z.object({
  task_id: z.string().uuid(),
  actual_quality: z.number().min(0).max(100),
  actual_difficulty: z.number().min(0).max(100),
  note: z.string().max(500).optional(),
});

export const paymentUpdateSchema = z.object({
  task_id: z.string().uuid(),
  payment_status: z.enum(["unpaid", "pending_payment", "paid", "rejected"]),
  payment_amount: z.number().min(0).optional(),
  payment_date: z.string().optional(),
  payment_note: z.string().max(500).optional(),
});

export type AcceptanceEvaluationInput = z.infer<typeof acceptanceEvaluationSchema>;
export type PaymentUpdateInput = z.infer<typeof paymentUpdateSchema>;
