// Tasks feature module barrel export
export {
  useTasks,
  useTask,
  useCreateTask,
  useUpdateTask,
  useEvaluateKPI,
  useUpdateProgress,
  taskKeys,
} from './hooks/use-tasks';

// Components
export { TaskDetail } from './components/task-detail';
export { TaskForm } from './components/task-form';
export { TaskAttachments } from './components/task-attachments';
export { TaskMessenger } from './components/task-messenger';
