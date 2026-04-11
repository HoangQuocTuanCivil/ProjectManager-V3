import { z } from "zod";

/* ── Enums ────────────────────────────────────────────────────── */

const taskStatus = z.enum(["pending", "in_progress", "review", "completed", "overdue", "cancelled"]);
const taskPriority = z.enum(["low", "medium", "high", "urgent"]);
const taskType = z.enum(["task", "product"]);
const healthScore = z.enum(["green", "yellow", "red", "gray"]);
const recurrenceType = z.enum(["daily", "weekly", "monthly", "quarterly", "yearly"]);

const optionalUuid = z.string().uuid().nullish();
const kpiField = z.number().min(0).max(100);
const kpiScore = z.number().min(0).max(110);

/* ── Create ───────────────────────────────────────────────────── */

export const createTaskSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(500),
  description: z.string().max(5000).nullish(),
  project_id: optionalUuid,
  assignee_id: optionalUuid,
  dept_id: optionalUuid,
  team_id: optionalUuid,
  priority: taskPriority.default("medium"),
  task_type: taskType.default("task"),
  kpi_weight: z.number().int().min(1).max(10).default(5),
  expect_quality: kpiField.default(100),
  expect_difficulty: kpiField.default(100),
  expect_volume: kpiField.default(100),
  expect_ahead: kpiField.default(100),
  start_date: z.string().nullish(),
  deadline: z.string().nullish(),
  parent_task_id: optionalUuid,
  template_id: optionalUuid,
  metadata: z.record(z.any()).optional(),
});

/* ── Update ───────────────────────────────────────────────────── */

export const patchTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullish(),
  status: taskStatus,
  priority: taskPriority,
  task_type: taskType,
  progress: z.number().int().min(0).max(100),
  assignee_id: optionalUuid,
  dept_id: optionalUuid,
  team_id: optionalUuid,
  project_id: optionalUuid,
  parent_task_id: optionalUuid,
  milestone_id: optionalUuid,
  goal_id: optionalUuid,
  allocation_id: optionalUuid,
  template_id: optionalUuid,
  kpi_weight: z.number().int().min(1).max(10),
  expect_volume: kpiField,
  expect_quality: kpiField,
  expect_difficulty: kpiField,
  expect_ahead: kpiField,
  actual_volume: kpiField,
  actual_quality: kpiField,
  actual_difficulty: kpiField,
  actual_ahead: kpiField,
  expect_score: kpiScore,
  actual_score: kpiScore,
  kpi_variance: z.number().min(-110).max(110),
  kpi_evaluated_by: optionalUuid,
  kpi_evaluated_at: z.string().nullish(),
  kpi_note: z.string().max(2000).nullish(),
  start_date: z.string().nullish(),
  deadline: z.string().nullish(),
  completed_at: z.string().nullish(),
  estimate_hours: z.number().min(0).max(99999).nullish(),
  actual_hours: z.number().min(0).max(99999).nullish(),
  health: healthScore,
  is_milestone: z.boolean(),
  is_recurring: z.boolean(),
  recurrence: recurrenceType.nullish(),
  recurrence_end: z.string().nullish(),
  metadata: z.record(z.any()).optional(),
}).partial();

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().uuid(),
});

/* ── Field Authorization Sets ────────────────────────────────── */

export const KPI_EVALUATION_FIELDS = new Set([
  "actual_volume", "actual_quality", "actual_difficulty", "actual_ahead",
  "actual_score", "kpi_variance",
  "kpi_evaluated_by", "kpi_evaluated_at", "kpi_note",
]);

export const MANAGEMENT_FIELDS = new Set([
  "title", "description", "assignee_id", "dept_id", "team_id", "project_id",
  "priority", "task_type", "status", "kpi_weight",
  "expect_volume", "expect_quality", "expect_difficulty", "expect_ahead",
  "start_date", "deadline", "parent_task_id", "milestone_id", "goal_id",
  "allocation_id", "template_id", "estimate_hours",
  "health", "is_milestone", "is_recurring", "recurrence", "recurrence_end",
]);

export const ASSIGNEE_SELF_FIELDS = new Set([
  "progress", "actual_hours", "metadata", "completed_at",
]);

/* ── Types ────────────────────────────────────────────────────── */

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type PatchTaskInput = z.infer<typeof patchTaskSchema>;
