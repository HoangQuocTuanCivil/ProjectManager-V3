export const STALE_TIMES = {
  SHORT: 15_000,
  DEFAULT: 30_000,
  LONG: 60_000,
} as const;

export const REFETCH_INTERVALS = {
  NOTIFICATIONS: 30_000,
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
} as const;

export const LIMITS = {
  NOTIFICATIONS_LIST: 50,
  KPI_RECORDS: 20,
} as const;
