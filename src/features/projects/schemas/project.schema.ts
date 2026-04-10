import { z } from "zod";

/* ── Enums ────────────────────────────────────────────────────── */

const projectStatus = z.enum(["planning", "active", "paused", "completed", "archived"]);

/* ── Create ───────────────────────────────────────────────────── */

export const createProjectSchema = z.object({
  code: z.string().min(1, "Mã dự án không được để trống").max(50),
  name: z.string().min(1, "Tên dự án không được để trống").max(255),
  description: z.string().max(2000).nullish(),
  dept_id: z.string().uuid().nullish(),
  manager_id: z.string().uuid().nullish(),
  status: projectStatus.default("planning"),
  budget: z.number().min(0).default(0),
  allocation_fund: z.number().min(0).default(0),
  start_date: z.string().nullish(),
  end_date: z.string().nullish(),
  location: z.string().max(500).nullish(),
  client: z.string().max(255).nullish(),
  contract_no: z.string().max(100).nullish(),
  metadata: z.record(z.any()).default({}),
  dept_ids: z.array(z.string().uuid()).optional(),
});

/* ── Update ───────────────────────────────────────────────────── */

export const updateProjectSchema = createProjectSchema.partial().extend({
  id: z.string().uuid(),
});

/* ── Types ────────────────────────────────────────────────────── */

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
