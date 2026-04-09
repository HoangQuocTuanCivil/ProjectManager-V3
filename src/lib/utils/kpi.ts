import type { Task, KPIScores, KPIComparison, KPIVerdict } from '@/lib/types';
import { KPI_WEIGHTS } from '@/lib/constants/kpi';

/** Tính điểm KPI: 3 chỉ số chính (KL+CL+ĐK = 100%), vượt TĐ là thưởng thêm tối đa 10% */
export function calcKPIScore(vol: number, qual: number, diff: number, ahd: number): number {
  const base = vol * KPI_WEIGHTS.volume + qual * KPI_WEIGHTS.quality + diff * KPI_WEIGHTS.difficulty;
  const bonus = ahd * KPI_WEIGHTS.ahead;
  return Math.round(base + bonus);
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

// Backward-compatible re-exports: constants and formatting moved to dedicated modules
export { KPI_WEIGHTS, VERDICT_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG, ROLE_CONFIG } from '@/lib/constants/kpi';
export { formatVND, formatPercent, formatDate, formatRelativeDate, daysBetween } from './format';
