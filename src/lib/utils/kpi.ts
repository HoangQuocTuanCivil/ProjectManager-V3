import type { Task, KPIScores, KPIComparison, KPIVerdict } from '@/lib/types';

export const KPI_WEIGHTS = { volume: 0.40, quality: 0.30, difficulty: 0.20, ahead: 0.10 };

export function calcKPIScore(vol: number, qual: number, diff: number, ahd: number): number {
  return Math.round(vol * KPI_WEIGHTS.volume + qual * KPI_WEIGHTS.quality + diff * KPI_WEIGHTS.difficulty + ahd * KPI_WEIGHTS.ahead);
}

export function getExpectedScores(task: Task): KPIScores {
  return {
    volume: task.expect_volume,
    quality: task.expect_quality,
    difficulty: task.expect_difficulty,
    ahead: task.expect_ahead,
    total: task.expect_score,
  };
}

export function getActualScores(task: Task): KPIScores {
  return {
    volume: task.actual_volume,
    quality: task.actual_quality,
    difficulty: task.actual_difficulty,
    ahead: task.actual_ahead,
    total: task.actual_score,
  };
}

export function getKPIComparison(task: Task): KPIComparison {
  const expected = getExpectedScores(task);
  const actual = getActualScores(task);
  const variance = task.kpi_variance ?? 0;
  return { expected, actual, variance, verdict: getVerdict(variance) };
}

export function getVerdict(variance: number | null): KPIVerdict {
  if (variance == null) return 'pending';
  if (variance >= 10) return 'exceptional';
  if (variance >= 0) return 'exceeded';
  if (variance >= -10) return 'near_target';
  return 'below_target';
}

export const VERDICT_CONFIG: Record<KPIVerdict, { label: string; color: string; bg: string }> = {
  exceptional: { label: 'Đặc biệt XS', color: '#10b981', bg: '#ecfdf5' },
  exceeded:    { label: 'Vượt kỳ vọng', color: '#3b82f6', bg: '#eff6ff' },
  near_target: { label: 'Gần đạt', color: '#f59e0b', bg: '#fffbeb' },
  below_target:{ label: 'Dưới KV', color: '#ef4444', bg: '#fef2f2' },
  pending:     { label: 'Chưa đánh giá', color: '#94a3b8', bg: '#f1f5f9' },
};

export function calcWeightedAvg(tasks: Task[], field: keyof Task): number {
  const totalW = tasks.reduce((s, t) => s + t.kpi_weight, 0);
  if (totalW === 0) return 0;
  return Math.round(tasks.reduce((s, t) => s + (Number(t[field]) || 0) * t.kpi_weight, 0) / totalW);
}

export function calcAllocation(
  userScores: { userId: string; score: number }[],
  totalFund: number
): { userId: string; score: number; share: number; amount: number }[] {
  const total = userScores.reduce((s, u) => s + u.score, 0);
  return userScores.map((u) => ({
    userId: u.userId,
    score: u.score,
    share: total > 0 ? u.score / total : 0,
    amount: total > 0 ? Math.round((u.score / total) * totalFund) : 0,
  }));
}

export function formatVND(n: number): string {
  return Math.round(n).toLocaleString('vi-VN') + 'đ';
}

export function formatPercent(n: number, decimals = 1): string {
  return n.toFixed(decimals) + '%';
}

export function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatRelativeDate(d: string): string {
  const now = new Date();
  const date = new Date(d);
  const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  if (diff < 7) return `${diff} ngày trước`;
  return formatDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

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
