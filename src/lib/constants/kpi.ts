import type { TaskStatus, TaskPriority, UserRole, KPIVerdict } from '@/lib/types';

/* Khối lượng 40% + Chất lượng 30% + Độ khó 30% = 100% cơ bản.
   Vượt tiến độ 10% là thưởng thêm (đúng hạn = 100%, vượt hạn = tối đa 110%). */
export const KPI_WEIGHTS = { volume: 0.40, quality: 0.30, difficulty: 0.30, ahead: 0.10 };

export const VERDICT_CONFIG: Record<KPIVerdict, { label: string; color: string; bg: string }> = {
  exceptional: { label: 'Đặc biệt XS', color: '#10b981', bg: '#ecfdf5' },
  exceeded:    { label: 'Vượt kỳ vọng', color: '#3b82f6', bg: '#eff6ff' },
  near_target: { label: 'Gần đạt', color: '#f59e0b', bg: '#fffbeb' },
  below_target:{ label: 'Dưới KV', color: '#ef4444', bg: '#fef2f2' },
  pending:     { label: 'Chưa đánh giá', color: '#94a3b8', bg: '#f1f5f9' },
};

export const STATUS_CONFIG = {
  pending:     { label: 'Chờ xử lý', color: '#94a3b8', bg: '#f1f5f9', icon: '○' },
  in_progress: { label: 'Đang làm', color: '#3b82f6', bg: '#eff6ff', icon: '◉' },
  review:      { label: 'Chờ duyệt', color: '#f59e0b', bg: '#fffbeb', icon: '◈' },
  completed:   { label: 'Hoàn thành', color: '#10b981', bg: '#ecfdf5', icon: '●' },
  overdue:     { label: 'Quá hạn', color: '#ef4444', bg: '#fef2f2', icon: '⊘' },
  cancelled:   { label: 'Hủy', color: '#6b7280', bg: '#f3f4f6', icon: '✕' },
} as const;

export const PRIORITY_CONFIG = {
  low:    { label: 'Thấp', color: '#94a3b8', icon: '▽' },
  medium: { label: 'TB', color: '#6366f1', icon: '●' },
  high:   { label: 'Cao', color: '#f59e0b', icon: '▲' },
  urgent: { label: 'Khẩn', color: '#ef4444', icon: '⬆' },
} as const;

export const ROLE_CONFIG = {
  admin:       { label: 'Admin', color: '#ef4444' },
  director:    { label: 'GĐ Trung tâm', color: '#a855f7' },
  leader:      { label: 'Lãnh đạo', color: '#f59e0b' },
  head:        { label: 'Trưởng phòng', color: '#3b82f6' },
  team_leader: { label: 'Trưởng nhóm', color: '#8b5cf6' },
  staff:       { label: 'Nhân viên', color: '#10b981' },
} as const;
