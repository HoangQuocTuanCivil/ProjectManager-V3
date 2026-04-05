# Technical Documentation — Revenue Module

## 1. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│  pages ← components ← hooks ← API routes ← Supabase    │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│                   PostgreSQL (Supabase)                  │
│  Tables + ENUMs + Triggers + Functions + RLS Policies    │
└─────────────────────────────────────────────────────────┘
```

## 2. Database Schema

### 2.1 New ENUMs

| ENUM | Values |
|------|--------|
| `revenue_entry_status` | draft, confirmed, adjusted, cancelled |
| `product_service_category` | design, consulting, survey, supervision, other |

### 2.2 New Tables

| Table | Purpose |
|-------|---------|
| `product_services` | Danh mục SP/DV (master data) |
| `revenue_adjustments` | Audit trail điều chỉnh doanh thu |
| `dept_revenue_allocations` | Phân bổ doanh thu theo phòng ban |

### 2.3 Altered Tables

`revenue_entries` — 6 cột mới:

| Column | Type | Default | Note |
|--------|------|---------|------|
| `product_service_id` | UUID FK | NULL | → product_services |
| `addendum_id` | UUID FK | NULL | → contract_addendums |
| `recognition_date` | DATE | CURRENT_DATE | Ngày ghi nhận kế toán |
| `status` | revenue_entry_status | 'draft' | Vòng đời bút toán |
| `completion_percentage` | NUMERIC(5,2) | 0 | CHECK 0-100 |
| `original_entry_id` | UUID FK | NULL | Self-ref cho đối ứng |

## 3. Triggers & Functions

### 3.1 Data Flow Diagram

```
billing_milestones.status → 'paid'
    │
    └──▶ trg_billing_paid
         └──▶ fn_revenue_from_billing()
              ├── INSERT revenue_entries (confirmed)
              └── PERFORM fn_allocate_dept_revenue()

tasks.metadata.payment_status → 'paid' + kpi_evaluated_at IS NOT NULL
    │
    └──▶ trg_task_acceptance_paid
         └──▶ fn_revenue_from_acceptance()
              └── INSERT revenue_entries (confirmed)

contract_addendums INSERT
    │
    └──▶ trg_addendum_created
         └──▶ fn_revenue_adjustment()
              ├── INSERT revenue_adjustments (audit)
              └── INSERT revenue_entries (draft, if value_change ≠ 0)
```

### 3.2 fn_allocate_dept_revenue(p_entry_id)

Stand-alone function, called from triggers and API:

1. Lấy entry info (amount, project_id)
2. Nếu project_id IS NULL → RETURN
3. Tính tỷ lệ:
   - Ưu tiên: `dept_budget_allocations` (allocated_amount / SUM)
   - Fallback: `project_departments` chia đều (100 / count)
4. INSERT `dept_revenue_allocations` (ON CONFLICT DO NOTHING)
5. UPDATE `revenue_entries.dept_id` = dept có % cao nhất

## 4. API Endpoints

### 4.1 CRUD

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/revenue` | team_leader+ | List + 10 filters + pagination + sort |
| POST | `/api/revenue` | team_leader+ | Create (default draft) |
| GET | `/api/revenue/[id]` | team_leader+ | Detail + allocations |
| PATCH | `/api/revenue/[id]` | team_leader+ | Update (draft only) |
| DELETE | `/api/revenue/[id]` | head+ | Delete (draft only) |
| POST | `/api/revenue/[id]/confirm` | head+ | Draft → confirmed + allocate |
| POST | `/api/revenue/[id]/cancel` | head+ | → cancelled + reversal entry |

### 4.2 Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/revenue/summary` | total, draft, byDimension/Method/Source, growthRate |
| GET | `/api/revenue/by-project/[id]` | entries, allocations, adjustments, avg_completion |
| GET | `/api/revenue/by-department` | dept_name, total_allocated, project_count |
| GET | `/api/revenue/by-period` | group_by=month/quarter/year |
| GET | `/api/revenue/forecast` | confirmed + pending + projected from milestones |
| GET | `/api/revenue/adjustments` | Adjustment history + pagination |

### 4.3 Product Services

| Method | Path | Auth |
|--------|------|------|
| GET | `/api/product-services` | any authenticated |
| POST | `/api/product-services` | head+ |
| PATCH | `/api/product-services/[id]` | head+ |
| DELETE | `/api/product-services/[id]` | head+ (soft-delete) |

### 4.4 Cron Jobs

| Path | Schedule | Description |
|------|----------|-------------|
| `/api/cron/revenue-completion` | Mon 6:00 | % hoàn thành → delta entry |
| `/api/cron/revenue-time-based` | 1st 1:00 | Phân bổ đều theo tháng |
| `/api/cron/revenue-overdue-check` | Daily 8:00 | Milestone overdue + notify |

## 5. RLS Policies

Pattern thống nhất cho 3 bảng mới:

| Table | SELECT | ALL (INSERT/UPDATE/DELETE) |
|-------|--------|---------------------------|
| product_services | `org_id = user_org_id()` | + `user_role() IN (admin, leader, director)` |
| revenue_adjustments | `org_id = user_org_id()` | + `user_role() IN (admin, leader, director)` |
| dept_revenue_allocations | `dept_id IN departments WHERE org_id = user_org_id()` | + `user_role() IN (admin, leader, director)` |

## 6. Frontend Architecture

```
src/features/revenue/
├── hooks/
│   ├── use-revenue.ts              # CRUD + confirm/cancel
│   ├── use-revenue-analytics.ts    # Summary, by-project/dept/period, forecast
│   ├── use-revenue-adjustments.ts  # Adjustment history
│   ├── use-product-services.ts     # SP/DV CRUD
│   └── use-dept-revenue.ts         # Dept allocations
├── components/
│   ├── revenue-summary-cards.tsx   # 5 KPI cards
│   ├── revenue-charts.tsx          # Bar + Pie + Line charts
│   ├── revenue-table.tsx           # Paginated table + actions
│   ├── revenue-filters.tsx         # 8 filter controls
│   ├── project-revenue-progress.tsx
│   ├── dept-allocation-chart.tsx
│   ├── dept-comparison-chart.tsx
│   ├── dept-revenue-table.tsx
│   ├── adjustment-timeline.tsx
│   ├── period-comparison.tsx
│   ├── revenue-method-breakdown.tsx
│   └── revenue-forecast-chart.tsx
├── utils/
│   └── export-revenue.ts           # Excel/PDF export
└── index.ts                        # Barrel exports
```

## 7. Query Key Namespace

```
["revenue"]                           # invalidation root
["revenue", "entries", filters]       # entry list
["revenue", "entry", id]             # single entry
["revenue", "analytics", ...]        # summary/project/dept/period/forecast
["revenue", "adjustments", ...]      # adjustment list
["revenue", "dept-allocations", ...] # dept allocations
["product-services", ...]            # SP/DV CRUD
```
