-- Migration: Add missing notification_type enum values
-- Adds workflow_pending, kpi_evaluated that are used by triggers

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'workflow_pending';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'kpi_evaluated';
