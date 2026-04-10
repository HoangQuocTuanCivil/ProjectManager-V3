export {
  useProjects,
  useProjectsPaginated,
  useProject,
  useCreateProject,
  useUpdateProject,
  useAddProjectMember,
  useRemoveProjectMember,
  useCreateMilestone,
  useUpdateMilestone,
  useDeleteMilestone,
  useDeleteProject,
  useArchiveProject,
  useRestoreProject,
  useProjectsSummary,
  projectKeys,
} from './hooks/use-projects';
export type { ProjectListFilters, ProjectSummaryItem } from './hooks/use-projects';

export { createProjectSchema, updateProjectSchema } from './schemas/project.schema';
export type { CreateProjectInput, UpdateProjectInput } from './schemas/project.schema';

export { ProjectHealthCard, MilestoneTimeline, ProjectMemberList } from './components/project-cards';
