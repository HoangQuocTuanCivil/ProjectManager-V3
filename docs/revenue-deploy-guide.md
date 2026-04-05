# Deploy Guide — Revenue Module

## Pre-deploy Checklist

- [ ] All E2E tests pass (`npx playwright test`)
- [ ] TypeScript compile clean (`npx tsc --noEmit`)
- [ ] UAT sign-off obtained
- [ ] Database backup completed

## 1. Database Migration

### 1.1 Backup

```bash
# Backup 3 bảng hiện tại
pg_dump --data-only -t revenue_entries -t internal_revenue -t cost_entries \
  -f backup_revenue_$(date +%Y%m%d).sql $DATABASE_URL
```

### 1.2 Apply Migration

```bash
# Apply schema changes
supabase db push
# Hoặc chạy trực tiếp:
psql $DATABASE_URL -f supabase/migrations/20260101000008_revenue_enhanced.sql
```

### 1.3 Data Migration

```bash
psql $DATABASE_URL -f scripts/migrate-revenue-data.sql
```

Script này sẽ:
1. Snapshot row count + total amount trước migration
2. UPDATE entries cũ: `status='confirmed'`, `recognition_date=COALESCE(period_start, created_at::date)`
3. Tạo `dept_revenue_allocations` cho entries có `project_id`
4. Verify: count match, amount match, no NULL, no orphans
5. Tự ROLLBACK nếu verify fail

### 1.4 Verify

```sql
-- Kiểm tra ENUMs
SELECT enum_range(NULL::revenue_entry_status);
SELECT enum_range(NULL::product_service_category);

-- Kiểm tra tables
SELECT COUNT(*) FROM product_services;
SELECT COUNT(*) FROM revenue_adjustments;
SELECT COUNT(*) FROM dept_revenue_allocations;

-- Kiểm tra triggers
SELECT tgname FROM pg_trigger WHERE tgname LIKE 'trg_%revenue%' OR tgname LIKE 'trg_billing%' OR tgname LIKE 'trg_addendum%';

-- Kiểm tra columns mới
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'revenue_entries' AND column_name IN ('status', 'recognition_date', 'product_service_id');
```

## 2. Application Deploy

### 2.1 Environment Variables

Không cần thêm env vars mới. Module sử dụng:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

### 2.2 Deploy

```bash
git push origin main
# Vercel auto-deploy
```

### 2.3 Verify Deployment

1. Truy cập `/revenue` → dashboard load, 5 cards hiện
2. Tạo bút toán draft → confirm → cancel
3. Vào `/revenue/departments` → chart hiện
4. Vào `/revenue/reports` → biểu đồ so sánh
5. Vào Settings → SP/DV → 5 seed items hiện
6. Export Excel → file tải về đúng

## 3. Cron Jobs

Vercel Cron tự hoạt động từ `vercel.json`:

| Job | Schedule | Verify |
|-----|----------|--------|
| revenue-completion | Mon 6:00 UTC | Check entries method=completion_rate |
| revenue-time-based | 1st 1:00 UTC | Check entries method=time_based |
| revenue-overdue-check | Daily 8:00 UTC | Check milestones status=overdue |

Test thủ công:
```bash
curl -X POST https://your-domain.vercel.app/api/cron/revenue-completion \
  -H "Authorization: Bearer $CRON_SECRET"
```

## 4. Rollback Plan

### 4.1 Application Rollback

```bash
# Revert to previous deployment
vercel rollback
```

### 4.2 Database Rollback

```sql
-- Drop new objects (reverse order)
DROP TRIGGER IF EXISTS trg_addendum_created ON contract_addendums;
DROP TRIGGER IF EXISTS trg_task_acceptance_paid ON tasks;
DROP TRIGGER IF EXISTS trg_billing_paid ON billing_milestones;
DROP FUNCTION IF EXISTS fn_revenue_adjustment();
DROP FUNCTION IF EXISTS fn_revenue_from_acceptance();
DROP FUNCTION IF EXISTS fn_revenue_from_billing();
DROP FUNCTION IF EXISTS fn_allocate_dept_revenue(UUID);

-- Drop RLS policies
DROP POLICY IF EXISTS dra_m ON dept_revenue_allocations;
DROP POLICY IF EXISTS dra_r ON dept_revenue_allocations;
DROP POLICY IF EXISTS ra_m ON revenue_adjustments;
DROP POLICY IF EXISTS ra_r ON revenue_adjustments;
DROP POLICY IF EXISTS ps_m ON product_services;
DROP POLICY IF EXISTS ps_r ON product_services;

-- Drop new tables
DROP TABLE IF EXISTS dept_revenue_allocations CASCADE;
DROP TABLE IF EXISTS revenue_adjustments CASCADE;
DROP TABLE IF EXISTS product_services CASCADE;

-- Remove new columns from revenue_entries
ALTER TABLE revenue_entries
  DROP COLUMN IF EXISTS product_service_id,
  DROP COLUMN IF EXISTS addendum_id,
  DROP COLUMN IF EXISTS recognition_date,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS completion_percentage,
  DROP COLUMN IF EXISTS original_entry_id;

-- Drop new ENUMs
DROP TYPE IF EXISTS product_service_category;
DROP TYPE IF EXISTS revenue_entry_status;

-- Restore from backup
psql $DATABASE_URL -f backup_revenue_YYYYMMDD.sql
```

### 4.3 Rollback Verification

```sql
-- Confirm old schema restored
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'revenue_entries' ORDER BY ordinal_position;

-- Confirm data intact
SELECT COUNT(*), SUM(amount) FROM revenue_entries;
```

## 5. Monitoring

After deploy, monitor for 24h:

- [ ] Supabase Dashboard: no spike in error rates
- [ ] Vercel Logs: no 500 errors on `/api/revenue/*`
- [ ] Cron Jobs: first execution completes without error
- [ ] RLS: staff user cannot create/modify entries (test in browser)
- [ ] Triggers: create addendum → check `revenue_adjustments` has new row
