import { z } from "zod";

const revenueDimension = z.enum(["project", "contract", "period", "product_service"]);
const recognitionMethod = z.enum(["acceptance", "completion_rate", "time_based"]);
const revenueSource = z.enum(["billing_milestone", "acceptance", "manual"]);

export const createRevenueEntrySchema = z.object({
  project_id: z.string().uuid().nullish(),
  contract_id: z.string().uuid().nullish(),
  dept_id: z.string().uuid().nullish(),
  dimension: revenueDimension.default("project"),
  method: recognitionMethod.default("acceptance"),
  source: revenueSource.default("manual"),
  source_id: z.string().uuid().nullish(),
  amount: z.number().positive("Số tiền phải lớn hơn 0"),
  description: z.string().min(1, "Mô tả không được để trống").max(2000),
  period_start: z.string().nullish(),
  period_end: z.string().nullish(),
  notes: z.string().max(2000).nullish(),
  product_service_id: z.string().uuid().nullish(),
  addendum_id: z.string().uuid().nullish(),
  recognition_date: z.string().nullish(),
  completion_percentage: z.number().min(0).max(100).default(0),
});

export const updateRevenueEntrySchema = createRevenueEntrySchema.partial();

export type CreateRevenueEntryInput = z.infer<typeof createRevenueEntrySchema>;
export type UpdateRevenueEntryInput = z.infer<typeof updateRevenueEntrySchema>;
