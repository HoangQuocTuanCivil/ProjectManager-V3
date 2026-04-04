import { create } from 'zustand';
import type { User, TaskFilters, TaskView, SettingsTab } from '@/lib/types';


interface AuthState {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));


export type TaskSortKey = "title" | "center" | "department" | "team" | "status" | "priority" | "assignee" | "expect_score" | "progress" | "deadline";

interface UIState {
  sidebarOpen: boolean;
  taskView: TaskView;
  settingsTab: SettingsTab;
  taskFilters: TaskFilters;
  taskSort: { key: TaskSortKey; dir: 'asc' | 'desc' };
  selectedProjectId: string | null;
  toggleSidebar: () => void;
  setTaskView: (v: TaskView) => void;
  setSettingsTab: (v: SettingsTab) => void;
  setTaskFilters: (f: Partial<TaskFilters>) => void;
  setTaskSort: (key: TaskSortKey, dir?: 'asc' | 'desc') => void;
  setSelectedProject: (id: string | null) => void;
  resetFilters: () => void;
}

const defaultFilters: TaskFilters = {
  status: 'all',
  priority: 'all',
  project_id: 'all',
  assignee_id: 'all',
  team_id: 'all',
  search: '',
};

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  taskView: 'grid',
  settingsTab: 'accounts',
  taskFilters: defaultFilters,
  taskSort: { key: 'deadline' as TaskSortKey, dir: 'asc' as const },
  selectedProjectId: null,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTaskView: (taskView) => set({ taskView }),
  setSettingsTab: (settingsTab) => set({ settingsTab }),
  setTaskFilters: (f) => set((s) => ({ taskFilters: { ...s.taskFilters, ...f } })),
  setTaskSort: (key, dir) => set((s) => ({
    taskSort: { key, dir: dir ?? (s.taskSort.key === key && s.taskSort.dir === 'asc' ? 'desc' : 'asc') },
  })),
  setSelectedProject: (selectedProjectId) => set({ selectedProjectId }),
  resetFilters: () => set({ taskFilters: defaultFilters }),
}));


interface NotifState {
  unreadCount: number;
  setUnreadCount: (n: number) => void;
  decrement: () => void;
}

export const useNotifStore = create<NotifState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (unreadCount) => set({ unreadCount }),
  decrement: () => set((s) => ({ unreadCount: Math.max(0, s.unreadCount - 1) })),
}));
