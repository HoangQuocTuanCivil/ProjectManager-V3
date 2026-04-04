import type { Json } from './database';

export interface DashboardWidget {
  id: string;
  dashboard_id: string;
  widget_type: 'chart' | 'number' | 'task_list' | 'goal' | 'workload' | 'kpi_ring';
  title: string | null;
  config: Record<string, Json | undefined>;
  position: { x: number; y: number; w: number; h: number };
}
