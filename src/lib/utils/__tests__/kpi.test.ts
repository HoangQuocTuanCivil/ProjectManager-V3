import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  KPI_WEIGHTS,
  calcKPIScore,
  getExpectedScores,
  getActualScores,
  getKPIComparison,
  getVerdict,
  calcWeightedAvg,
  calcAllocation,
  formatVND,
  formatPercent,
  formatDate,
  formatRelativeDate,
  daysBetween,
} from '../kpi';
import type { Task } from '@/lib/types';

/* Tạo mock Task với các trường KPI cần thiết */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '1',
    org_id: 'org-1',
    dept_id: null,
    project_id: null,
    title: 'Test task',
    description: null,
    assignee_id: null,
    assigner_id: 'u-1',
    status: 'pending',
    priority: 'medium',
    task_type: 'task',
    kpi_weight: 1,
    progress: 0,
    expect_volume: 80,
    expect_quality: 90,
    expect_difficulty: 70,
    expect_ahead: 100,
    expect_score: 85,
    actual_volume: 75,
    actual_quality: 85,
    actual_difficulty: 65,
    actual_ahead: 95,
    actual_score: 80,
    kpi_variance: -5,
    kpi_evaluated_by: null,
    kpi_evaluated_at: null,
    kpi_note: null,
    start_date: null,
    deadline: null,
    completed_at: null,
    parent_task_id: null,
    milestone_id: null,
    goal_id: null,
    allocation_id: null,
    estimate_hours: null,
    actual_hours: null,
    health: 'green',
    is_milestone: false,
    is_recurring: false,
    metadata: {},
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    team_id: null,
    ...overrides,
  };
}

// ─── KPI Weights ───────────────────────────────────────────
describe('KPI_WEIGHTS', () => {
  it('tổng trọng số = 1.0', () => {
    const total = KPI_WEIGHTS.volume + KPI_WEIGHTS.quality + KPI_WEIGHTS.difficulty + KPI_WEIGHTS.ahead;
    expect(total).toBeCloseTo(1.0);
  });
});

// ─── calcKPIScore ──────────────────────────────────────────
describe('calcKPIScore', () => {
  it('tính điểm KPI theo trọng số và làm tròn', () => {
    // 80*0.4 + 90*0.3 + 70*0.2 + 100*0.1 = 32 + 27 + 14 + 10 = 83
    expect(calcKPIScore(80, 90, 70, 100)).toBe(83);
  });

  it('trả về 0 khi tất cả đầu vào = 0', () => {
    expect(calcKPIScore(0, 0, 0, 0)).toBe(0);
  });

  it('trả về 100 khi tất cả đầu vào = 100', () => {
    expect(calcKPIScore(100, 100, 100, 100)).toBe(100);
  });
});

// ─── getExpectedScores / getActualScores ───────────────────
describe('getExpectedScores', () => {
  it('trích xuất điểm kỳ vọng từ task', () => {
    const task = makeTask();
    expect(getExpectedScores(task)).toEqual({
      volume: 80, quality: 90, difficulty: 70, ahead: 100, total: 85,
    });
  });
});

describe('getActualScores', () => {
  it('trích xuất điểm thực tế từ task', () => {
    const task = makeTask();
    expect(getActualScores(task)).toEqual({
      volume: 75, quality: 85, difficulty: 65, ahead: 95, total: 80,
    });
  });
});

// ─── getKPIComparison ──────────────────────────────────────
describe('getKPIComparison', () => {
  it('trả về expected, actual, variance và verdict', () => {
    const task = makeTask({ kpi_variance: -5 });
    const result = getKPIComparison(task);
    expect(result.variance).toBe(-5);
    expect(result.verdict).toBe('near_target');
    expect(result.expected.total).toBe(85);
    expect(result.actual.total).toBe(80);
  });

  it('variance fallback = 0 khi kpi_variance = null → verdict = exceeded', () => {
    const task = makeTask({ kpi_variance: null });
    const result = getKPIComparison(task);
    // kpi_variance ?? 0 → variance = 0 → getVerdict(0) = 'exceeded'
    expect(result.variance).toBe(0);
    expect(result.verdict).toBe('exceeded');
  });
});

// ─── getVerdict ────────────────────────────────────────────
describe('getVerdict', () => {
  it('null → pending', () => expect(getVerdict(null)).toBe('pending'));
  it('>= 10 → exceptional', () => expect(getVerdict(10)).toBe('exceptional'));
  it('15 → exceptional', () => expect(getVerdict(15)).toBe('exceptional'));
  it('0 → exceeded', () => expect(getVerdict(0)).toBe('exceeded'));
  it('5 → exceeded', () => expect(getVerdict(5)).toBe('exceeded'));
  it('-5 → near_target', () => expect(getVerdict(-5)).toBe('near_target'));
  it('-10 → near_target', () => expect(getVerdict(-10)).toBe('near_target'));
  it('-11 → below_target', () => expect(getVerdict(-11)).toBe('below_target'));
});

// ─── calcWeightedAvg ───────────────────────────────────────
describe('calcWeightedAvg', () => {
  it('tính trung bình có trọng số theo kpi_weight', () => {
    const tasks = [
      makeTask({ kpi_weight: 2, actual_score: 80 }),
      makeTask({ kpi_weight: 1, actual_score: 50 }),
    ];
    // (80*2 + 50*1) / (2+1) = 210/3 = 70
    expect(calcWeightedAvg(tasks, 'actual_score')).toBe(70);
  });

  it('trả về 0 khi tổng kpi_weight = 0', () => {
    const tasks = [makeTask({ kpi_weight: 0 })];
    expect(calcWeightedAvg(tasks, 'actual_score')).toBe(0);
  });

  it('trả về 0 với mảng rỗng', () => {
    expect(calcWeightedAvg([], 'actual_score')).toBe(0);
  });
});

// ─── calcAllocation ────────────────────────────────────────
describe('calcAllocation', () => {
  it('phân bổ theo tỷ lệ điểm số', () => {
    const result = calcAllocation(
      [
        { userId: 'a', score: 60 },
        { userId: 'b', score: 40 },
      ],
      1_000_000,
    );
    expect(result).toHaveLength(2);
    expect(result[0].share).toBeCloseTo(0.6);
    expect(result[0].amount).toBe(600_000);
    expect(result[1].share).toBeCloseTo(0.4);
    expect(result[1].amount).toBe(400_000);
  });

  it('trả về share=0, amount=0 khi tổng điểm = 0', () => {
    const result = calcAllocation([{ userId: 'a', score: 0 }], 1_000_000);
    expect(result[0].share).toBe(0);
    expect(result[0].amount).toBe(0);
  });
});

// ─── Format helpers ────────────────────────────────────────
describe('formatVND', () => {
  it('định dạng số tiền VND', () => {
    const result = formatVND(1500000);
    expect(result).toContain('đ');
    expect(result).toContain('1');
  });
});

describe('formatPercent', () => {
  it('thêm ký hiệu % với số thập phân mặc định', () => {
    expect(formatPercent(85.67)).toBe('85.7%');
  });

  it('chấp nhận tham số decimals tuỳ chỉnh', () => {
    expect(formatPercent(85.67, 2)).toBe('85.67%');
  });
});

describe('formatDate', () => {
  it('trả về "—" khi input null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('định dạng ngày theo locale vi-VN', () => {
    const result = formatDate('2026-03-15');
    expect(result).toMatch(/15/);
    expect(result).toMatch(/03/);
    expect(result).toMatch(/2026/);
  });
});

describe('formatRelativeDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-04T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('trả về "Hôm nay" cho ngày hiện tại', () => {
    expect(formatRelativeDate('2026-04-04T10:00:00Z')).toBe('Hôm nay');
  });

  it('trả về "Hôm qua" cho ngày trước đó 1 ngày', () => {
    expect(formatRelativeDate('2026-04-03T10:00:00Z')).toBe('Hôm qua');
  });

  it('trả về "X ngày trước" khi < 7 ngày', () => {
    expect(formatRelativeDate('2026-04-01T10:00:00Z')).toBe('3 ngày trước');
  });

  it('trả về ngày đầy đủ khi >= 7 ngày trước', () => {
    const result = formatRelativeDate('2026-03-20T10:00:00Z');
    expect(result).toMatch(/20/);
  });
});

describe('daysBetween', () => {
  it('tính số ngày giữa 2 mốc thời gian', () => {
    expect(daysBetween('2026-01-01', '2026-01-11')).toBe(10);
  });

  it('trả về số âm khi ngày đầu sau ngày cuối', () => {
    expect(daysBetween('2026-01-11', '2026-01-01')).toBe(-10);
  });
});
