// KPI feature module barrel export

// Shared keys
export { kpiKeys } from './hooks/kpi-keys';

// Allocation (config, periods, dept budget, cycle)
export {
  useAllocationConfigs,
  useAllocationConfig,
  useAllocationPeriods,
  useCreateAllocationPeriod,
  useCalculateAllocation,
  useApproveAllocation,
  useDeleteAllocationPeriod,
  useDeptBudgetAllocations,
  useUpsertDeptBudgetAllocation,
  useUpdateDeptBudgetAllocation,
  useDeleteDeptBudgetAllocation,
  useAllocationCycle,
  useUpdateAllocationCycle,
} from './hooks/use-allocation';

// Fund & bonus
export {
  useFundSummary,
  useEmployeeBonus,
  useCalculateBonus,
  usePreviewFund,
} from './hooks/use-fund';

// Salary
export {
  useSalaryRecords,
  useCreateSalaryBatch,
  useDeleteSalary,
  useSalaryDeductions,
} from './hooks/use-salary';

// Acceptance rounds
export {
  useAcceptanceRounds,
  useUpsertAcceptanceRound,
  useDeleteAcceptanceRound,
} from './hooks/use-acceptance-rounds';

// Components
export { AllocationTable, UserKPICard } from './components/kpi-cards';
