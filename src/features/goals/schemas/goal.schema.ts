import { z } from "zod";

const goalType = z.enum(["company", "center", "department", "team", "personal"]);
const goalStatus = z.enum(["on_track", "at_risk", "off_track", "achieved", "cancelled"]);

export const createGoalSchema = z.object({
  title: z.string().min(1, "Tiêu đề không được để trống").max(500),
  description: z.string().max(5000).nullish(),
  goal_type: goalType.default("personal"),
  status: goalStatus.default("on_track"),
  owner_id: z.string().uuid().nullish(),
  dept_id: z.string().uuid().nullish(),
  parent_goal_id: z.string().uuid().nullish(),
  period_label: z.string().max(100).nullish(),
  start_date: z.string().nullish(),
  due_date: z.string().nullish(),
  progress: z.number().int().min(0).max(100).default(0),
  progress_source: z.string().max(50).default("manual"),
  is_public: z.boolean().default(true),
  color: z.string().max(20).default("#3b82f6"),
});

export const updateGoalSchema = createGoalSchema.partial();

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
