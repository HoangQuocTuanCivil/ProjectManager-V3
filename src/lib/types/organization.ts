import type { Json } from './database';
import type { UserRole } from './enums';

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  logo_url: string | null;
  settings: Record<string, Json | undefined>;
  created_at: string;
}

export interface Department {
  id: string;
  org_id: string;
  center_id: string | null;
  name: string;
  code: string;
  description: string | null;
  head_user_id: string | null;
  sort_order: number;
  is_active: boolean;
  // Joined
  head?: User;
  center?: Center;
  member_count?: number;
  teams?: Team[];
}

export interface Team {
  id: string;
  org_id: string;
  dept_id: string;
  name: string;
  code: string | null;
  description: string | null;
  leader_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  // Joined
  leader?: User;
  department?: Department;
  member_count?: number;
}

export interface Center {
  id: string;
  org_id: string;
  name: string;
  code: string | null;
  description: string | null;
  director_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  // Joined
  director?: User;
  departments?: Department[];
  member_count?: number;
}

export interface User {
  id: string;
  org_id: string;
  dept_id: string | null;
  center_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  job_title: string | null;
  is_active: boolean;
  custom_role_id: string | null;
  team_id: string | null;
  last_login: string | null;
  login_count: number;
  settings: UserSettings;
  created_at: string;
  // Joined
  department?: Department;
  center?: Center;
  team?: Team;
}

export interface UserSettings {
  notifications_email: boolean;
  notifications_push: boolean;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

export interface DepartmentSummary {
  id: string;
  name: string;
  code: string;
}

export interface Permission {
  id: string;
  group_name: string;
  name: string;
  sort_order: number;
}

export interface CustomRole {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  color: string;
  base_role: UserRole;
  permissions?: Permission[];
}

export interface OrgSetting {
  id: string;
  org_id: string;
  category: string;
  key: string;
  value: Json;
  description: string | null;
}

export interface UserUpdateInput {
  full_name?: string;
  email?: string;
  phone?: string | null;
  avatar_url?: string | null;
  role?: UserRole;
  dept_id?: string | null;
  center_id?: string | null;
  team_id?: string | null;
  job_title?: string | null;
  is_active?: boolean;
  custom_role_id?: string | null;
  manager_id?: string | null;
}

export interface CenterUpdateInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  director_id?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

export interface TeamUpdateInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  dept_id?: string;
  leader_id?: string | null;
  is_active?: boolean;
  sort_order?: number;
}
