import { z } from "zod";

export const calculateAllocationSchema = z.object({
  period_id: z.string().uuid("period_id không hợp lệ"),
  use_actual: z.boolean().default(true),
});

export const createAcceptanceRoundSchema = z.object({
  allocation_id: z.string().uuid("allocation_id không hợp lệ"),
  round_name: z.string().min(1, "Tên đợt nghiệm thu không được để trống").max(255),
  amount: z.number().min(0, "Số tiền phải >= 0"),
  round_date: z.string().nullish(),
  note: z.string().max(1000).nullish(),
  sort_order: z.number().int().default(0),
});

export type CalculateAllocationInput = z.infer<typeof calculateAllocationSchema>;
export type CreateAcceptanceRoundInput = z.infer<typeof createAcceptanceRoundSchema>;
