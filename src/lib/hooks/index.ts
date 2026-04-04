// Re-export all hooks from a single entry point
export { useTasks, useTask, useCreateTask, useUpdateTask, useEvaluateKPI, useUpdateProgress, taskKeys } from "./use-tasks";
export { useProjects, useProject, useCreateProject, projectKeys } from "./use-projects";
export { useWorkflows, useWorkflow, usePendingApprovals, useAdvanceWorkflow, useCreateWorkflow, useToggleWorkflow, workflowKeys } from "./use-workflows";
export {
  useKPIRecords, useAllocationConfig, useAllocationPeriods, useCreateAllocationPeriod,
  useCalculateAllocation, useApproveAllocation, kpiKeys,
  useUsers, useUser, useUpdateUser, useInviteUser, userKeys,
  useNotifications, useUnreadCount, useMarkRead, useMarkAllRead, notifKeys,
  useGoals, useCreateGoal, goalKeys,
  useOrgSettings, useUpdateSetting, usePermissions, useCustomRoles, settingsKeys,
  useSignOut,
} from "./use-data";
