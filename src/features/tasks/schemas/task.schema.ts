import { z } from "zod";

/* ── Enums ────────────────────────────────────────────────────── */

const taskPriority = z.enum(["low", "medium", "high", "urgent"]);
const taskType = z.enum(["task", "product"]);

/* ── Create ───────────────────────────────────────────────────── */

export const createTaskSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(500),
  description: z.string().max(5000).nullish(),
  project_id: z.string().uuid().nullish(),
  assignee_id: z.string().uuid().nullish(),
  dept_id: z.string().uuid().nullish(),
  team_id: z.string().uuid().nullish(),
  priority: taskPriority.default("medium"),
  task_type: taskType.default("task"),
  kpi_weight: z.number().min(0).max(100).default(1),
  expect_quality: z.number().min(0).max(100).default(100),
  expect_difficulty: z.number().min(0).max(100).default(100),
  expect_volume: z.number().min(0).max(100).default(100),
  expect_ahead: z.number().min(0).max(100).default(100),
  start_date: z.string().nullish(),
  deadline: z.string().nullish(),
  parent_task_id: z.string().uuid().nullish(),
  template_id: z.string().uuid().nullish(),
  metadata: z.record(z.any()).optional(),
});

/* ── Update ───────────────────────────────────────────────────── */

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().uuid(),
});

/* ── Types ────────────────────────────────────────────────────── */

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
