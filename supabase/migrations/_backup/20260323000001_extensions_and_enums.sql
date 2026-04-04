-- Migration 001: Extensions & Enum Types
-- A2Z WorkHub — PostgreSQL 15 + Supabase

-- EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ENUM TYPES
CREATE TYPE user_role AS ENUM ('admin', 'leader', 'head', 'staff');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'review', 'completed', 'overdue', 'cancelled');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE task_type AS ENUM ('task', 'product');
CREATE TYPE period_type AS ENUM ('week', 'month', 'quarter', 'year');
CREATE TYPE notification_type AS ENUM ('task_assigned','task_updated','task_overdue','task_completed','task_review','kpi_report','allocation_approved','system');
CREATE TYPE allocation_status AS ENUM ('draft', 'calculated', 'approved', 'paid', 'rejected');
CREATE TYPE allocation_mode AS ENUM ('per_project', 'global');
CREATE TYPE project_status AS ENUM ('planning', 'active', 'paused', 'completed', 'archived');
CREATE TYPE project_member_role AS ENUM ('manager', 'leader', 'engineer', 'reviewer');
CREATE TYPE goal_type AS ENUM ('company', 'department', 'team', 'personal');
CREATE TYPE goal_status AS ENUM ('on_track', 'at_risk', 'off_track', 'achieved', 'cancelled');
CREATE TYPE target_type AS ENUM ('number', 'currency', 'percentage', 'boolean', 'task_completion');
CREATE TYPE milestone_status AS ENUM ('upcoming', 'reached', 'missed');
CREATE TYPE health_score AS ENUM ('green', 'yellow', 'red', 'gray');
CREATE TYPE dependency_type AS ENUM ('blocking', 'waiting_on', 'related');
CREATE TYPE recurrence_type AS ENUM ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly');
CREATE TYPE session_status AS ENUM ('active', 'expired', 'revoked');
CREATE TYPE audit_action AS ENUM ('login','logout','create','update','delete','approve','reject','export','password_change','role_change');
CREATE TYPE workflow_step_type AS ENUM ('create','assign','execute','submit','review','approve','reject','revise','calculate','notify','archive','custom');
CREATE TYPE workflow_scope AS ENUM ('global', 'department', 'project', 'task_type');
