export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      dept_budget_allocations: {
        Row: {
          id: string
          org_id: string
          project_id: string
          dept_id: string
          allocated_amount: number
          note: string | null
          created_by: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          project_id: string
          dept_id: string
          allocated_amount?: number
          note?: string | null
          created_by: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          project_id?: string
          dept_id?: string
          allocated_amount?: number
          note?: string | null
          created_by?: string
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dept_budget_allocations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_budget_allocations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_budget_allocations_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dept_budget_allocations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_configs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string | null
          weight_ahead: number
          weight_difficulty: number
          weight_quality: number
          weight_volume: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id: string
          updated_at?: string | null
          weight_ahead?: number
          weight_difficulty?: number
          weight_quality?: number
          weight_volume?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
          weight_ahead?: number
          weight_difficulty?: number
          weight_quality?: number
          weight_volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "allocation_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_periods: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          config_id: string
          created_at: string | null
          dept_id: string | null
          id: string
          metadata: Json | null
          mode: Database["public"]["Enums"]["allocation_mode"]
          name: string
          notes: string | null
          org_id: string
          period_end: string
          period_start: string
          project_id: string | null
          status: Database["public"]["Enums"]["allocation_status"]
          total_fund: number
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          config_id: string
          created_at?: string | null
          dept_id?: string | null
          id?: string
          metadata?: Json | null
          mode?: Database["public"]["Enums"]["allocation_mode"]
          name: string
          notes?: string | null
          org_id: string
          period_end: string
          period_start: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["allocation_status"]
          total_fund: number
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          config_id?: string
          created_at?: string | null
          dept_id?: string | null
          id?: string
          metadata?: Json | null
          mode?: Database["public"]["Enums"]["allocation_mode"]
          name?: string
          notes?: string | null
          org_id?: string
          period_end?: string
          period_start?: string
          project_id?: string | null
          status?: Database["public"]["Enums"]["allocation_status"]
          total_fund?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_periods_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "allocation_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_periods_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_periods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_results: {
        Row: {
          allocated_amount: number | null
          avg_ahead: number | null
          avg_difficulty: number | null
          avg_quality: number | null
          avg_volume: number | null
          breakdown: Json | null
          calculated_at: string | null
          id: string
          mode: Database["public"]["Enums"]["allocation_mode"]
          period_id: string
          project_id: string | null
          share_percentage: number | null
          task_count: number | null
          user_id: string
          weighted_score: number | null
        }
        Insert: {
          allocated_amount?: number | null
          avg_ahead?: number | null
          avg_difficulty?: number | null
          avg_quality?: number | null
          avg_volume?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["allocation_mode"]
          period_id: string
          project_id?: string | null
          share_percentage?: number | null
          task_count?: number | null
          user_id: string
          weighted_score?: number | null
        }
        Update: {
          allocated_amount?: number | null
          avg_ahead?: number | null
          avg_difficulty?: number | null
          avg_quality?: number | null
          avg_volume?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["allocation_mode"]
          period_id?: string
          project_id?: string | null
          share_percentage?: number | null
          task_count?: number | null
          user_id?: string
          weighted_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_results_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "allocation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          org_id: string
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          org_id: string
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          org_id?: string
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          actions_executed: Json | null
          error: string | null
          executed_at: string | null
          id: string
          rule_id: string
          success: boolean | null
          trigger_data: Json | null
        }
        Insert: {
          actions_executed?: Json | null
          error?: string | null
          executed_at?: string | null
          id?: string
          rule_id: string
          success?: boolean | null
          trigger_data?: Json | null
        }
        Update: {
          actions_executed?: Json | null
          error?: string | null
          executed_at?: string | null
          id?: string
          rule_id?: string
          success?: boolean | null
          trigger_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "automation_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          actions: Json
          conditions: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          last_run_at: string | null
          name: string
          org_id: string
          project_id: string | null
          run_count: number | null
          trigger_config: Json
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          actions?: Json
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name: string
          org_id: string
          project_id?: string | null
          run_count?: number | null
          trigger_config?: Json
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          actions?: Json
          conditions?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          last_run_at?: string | null
          name?: string
          org_id?: string
          project_id?: string | null
          run_count?: number | null
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_rules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          code: string | null
          created_at: string | null
          description: string | null
          director_id: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          director_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          description?: string | null
          director_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centers_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assignee_id: string | null
          checked_at: string | null
          checklist_id: string
          content: string
          created_at: string | null
          due_date: string | null
          id: string
          is_checked: boolean | null
          sort_order: number | null
        }
        Insert: {
          assignee_id?: string | null
          checked_at?: string | null
          checklist_id: string
          content: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_checked?: boolean | null
          sort_order?: number | null
        }
        Update: {
          assignee_id?: string | null
          checked_at?: string | null
          checklist_id?: string
          content?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          is_checked?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "task_checklists"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          base_role: Database["public"]["Enums"]["user_role"]
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          is_system: boolean | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          base_role?: Database["public"]["Enums"]["user_role"]
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          base_role?: Database["public"]["Enums"]["user_role"]
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_roles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_widgets: {
        Row: {
          config: Json
          created_at: string | null
          dashboard_id: string
          id: string
          position: Json
          sort_order: number | null
          title: string | null
          widget_type: string
        }
        Insert: {
          config?: Json
          created_at?: string | null
          dashboard_id: string
          id?: string
          position?: Json
          sort_order?: number | null
          title?: string | null
          widget_type: string
        }
        Update: {
          config?: Json
          created_at?: string | null
          dashboard_id?: string
          id?: string
          position?: Json
          sort_order?: number | null
          title?: string | null
          widget_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_widgets_dashboard_id_fkey"
            columns: ["dashboard_id"]
            isOneToOne: false
            referencedRelation: "dashboards"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboards: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_shared: boolean | null
          layout: Json | null
          org_id: string
          owner_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean | null
          layout?: Json | null
          org_id: string
          owner_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_shared?: boolean | null
          layout?: Json | null
          org_id?: string
          owner_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dashboards_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dashboards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          center_id: string | null
          code: string
          created_at: string | null
          description: string | null
          head_user_id: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          center_id?: string | null
          code: string
          created_at?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          center_id?: string | null
          code?: string
          created_at?: string | null
          description?: string | null
          head_user_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_dept_head"
            columns: ["head_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          created_at: string | null
          data: Json
          form_id: string
          id: string
          submitted_by: string | null
          task_id: string | null
        }
        Insert: {
          created_at?: string | null
          data: Json
          form_id: string
          id?: string
          submitted_by?: string | null
          task_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json
          form_id?: string
          id?: string
          submitted_by?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "intake_forms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      global_kpi_summary: {
        Row: {
          avg_ahead: number | null
          avg_difficulty: number | null
          avg_quality: number | null
          avg_volume: number | null
          calculated_at: string | null
          id: string
          kpi_score: number | null
          org_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          project_breakdown: Json | null
          projects_count: number | null
          tasks_completed: number | null
          tasks_overdue: number | null
          tasks_total: number | null
          user_id: string
        }
        Insert: {
          avg_ahead?: number | null
          avg_difficulty?: number | null
          avg_quality?: number | null
          avg_volume?: number | null
          calculated_at?: string | null
          id?: string
          kpi_score?: number | null
          org_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          project_breakdown?: Json | null
          projects_count?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          tasks_total?: number | null
          user_id: string
        }
        Update: {
          avg_ahead?: number | null
          avg_difficulty?: number | null
          avg_quality?: number | null
          avg_volume?: number | null
          calculated_at?: string | null
          id?: string
          kpi_score?: number | null
          org_id?: string
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          project_breakdown?: Json | null
          projects_count?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          tasks_total?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "global_kpi_summary_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "global_kpi_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_projects: {
        Row: {
          goal_id: string
          project_id: string
        }
        Insert: {
          goal_id: string
          project_id: string
        }
        Update: {
          goal_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_projects_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_projects_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_targets: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_value: number | null
          goal_id: string
          id: string
          is_completed: boolean | null
          start_value: number | null
          target_type: Database["public"]["Enums"]["target_type"]
          target_value: number
          title: string
          unit: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          goal_id: string
          id?: string
          is_completed?: boolean | null
          start_value?: number | null
          target_type?: Database["public"]["Enums"]["target_type"]
          target_value: number
          title: string
          unit?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_value?: number | null
          goal_id?: string
          id?: string
          is_completed?: boolean | null
          start_value?: number | null
          target_type?: Database["public"]["Enums"]["target_type"]
          target_value?: number
          title?: string
          unit?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_targets_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          color: string | null
          created_at: string | null
          dept_id: string | null
          description: string | null
          due_date: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          id: string
          is_public: boolean | null
          metadata: Json | null
          org_id: string
          owner_id: string | null
          parent_goal_id: string | null
          period_label: string | null
          progress: number | null
          progress_source: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          dept_id?: string | null
          description?: string | null
          due_date?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          org_id: string
          owner_id?: string | null
          parent_goal_id?: string | null
          period_label?: string | null
          progress?: number | null
          progress_source?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          dept_id?: string | null
          description?: string | null
          due_date?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          id?: string
          is_public?: boolean | null
          metadata?: Json | null
          org_id?: string
          owner_id?: string | null
          parent_goal_id?: string | null
          period_label?: string | null
          progress?: number | null
          progress_source?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          auto_assign_to: string | null
          created_at: string | null
          created_by: string | null
          default_priority: Database["public"]["Enums"]["task_priority"] | null
          description: string | null
          fields: Json
          id: string
          is_active: boolean | null
          is_public: boolean | null
          org_id: string
          submission_count: number | null
          target_dept_id: string | null
          target_project_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          auto_assign_to?: string | null
          created_at?: string | null
          created_by?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"] | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          org_id: string
          submission_count?: number | null
          target_dept_id?: string | null
          target_project_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          auto_assign_to?: string | null
          created_at?: string | null
          created_by?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"] | null
          description?: string | null
          fields?: Json
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          org_id?: string
          submission_count?: number | null
          target_dept_id?: string | null
          target_project_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_auto_assign_to_fkey"
            columns: ["auto_assign_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_target_dept_id_fkey"
            columns: ["target_dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_configs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          ontime_weight: number | null
          org_id: string
          progress_weight: number | null
          updated_at: string | null
          volume_weight: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          ontime_weight?: number | null
          org_id: string
          progress_weight?: number | null
          updated_at?: string | null
          volume_weight?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          ontime_weight?: number | null
          org_id?: string
          progress_weight?: number | null
          updated_at?: string | null
          volume_weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_records: {
        Row: {
          breakdown: Json | null
          calculated_at: string | null
          dept_id: string | null
          id: string
          org_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_end: string
          period_start: string
          score: number | null
          tasks_assigned: number | null
          tasks_completed: number | null
          tasks_on_time: number | null
          tasks_overdue: number | null
          user_id: string | null
        }
        Insert: {
          breakdown?: Json | null
          calculated_at?: string | null
          dept_id?: string | null
          id?: string
          org_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_end: string
          period_start: string
          score?: number | null
          tasks_assigned?: number | null
          tasks_completed?: number | null
          tasks_on_time?: number | null
          tasks_overdue?: number | null
          user_id?: string | null
        }
        Update: {
          breakdown?: Json | null
          calculated_at?: string | null
          dept_id?: string | null
          id?: string
          org_id?: string
          period?: Database["public"]["Enums"]["period_type"]
          period_end?: string
          period_start?: string
          score?: number | null
          tasks_assigned?: number | null
          tasks_completed?: number | null
          tasks_on_time?: number | null
          tasks_overdue?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_records_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_records_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string
          goal_id: string | null
          id: string
          project_id: string
          reached_at: string | null
          sort_order: number | null
          status: Database["public"]["Enums"]["milestone_status"] | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date: string
          goal_id?: string | null
          id?: string
          project_id: string
          reached_at?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["milestone_status"] | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string
          goal_id?: string | null
          id?: string
          project_id?: string
          reached_at?: string | null
          sort_order?: number | null
          status?: Database["public"]["Enums"]["milestone_status"] | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          org_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          org_id: string
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          org_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          category: string
          description: string | null
          id: string
          key: string
          org_id: string
          updated_at: string | null
          updated_by: string | null
          value: Json
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          key: string
          org_id: string
          updated_at?: string | null
          updated_by?: string | null
          value: Json
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          key?: string
          org_id?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          domain: string | null
          id: string
          logo_url: string | null
          name: string
          settings: Json | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          name: string
          settings?: Json | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          domain?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          settings?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          description: string | null
          group_name: string
          id: string
          name: string
          sort_order: number | null
        }
        Insert: {
          description?: string | null
          group_name: string
          id: string
          name: string
          sort_order?: number | null
        }
        Update: {
          description?: string | null
          group_name?: string
          id?: string
          name?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      project_departments: {
        Row: {
          created_at: string | null
          dept_id: string
          project_id: string
        }
        Insert: {
          created_at?: string | null
          dept_id: string
          project_id: string
        }
        Update: {
          created_at?: string | null
          dept_id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_departments_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_departments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_kpi_summary: {
        Row: {
          avg_ahead: number | null
          avg_difficulty: number | null
          avg_quality: number | null
          avg_volume: number | null
          breakdown: Json | null
          calculated_at: string | null
          id: string
          kpi_score: number | null
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          project_id: string
          tasks_completed: number | null
          tasks_overdue: number | null
          tasks_total: number | null
          total_kpi_weight: number | null
          user_id: string
        }
        Insert: {
          avg_ahead?: number | null
          avg_difficulty?: number | null
          avg_quality?: number | null
          avg_volume?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
          id?: string
          kpi_score?: number | null
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          project_id: string
          tasks_completed?: number | null
          tasks_overdue?: number | null
          tasks_total?: number | null
          total_kpi_weight?: number | null
          user_id: string
        }
        Update: {
          avg_ahead?: number | null
          avg_difficulty?: number | null
          avg_quality?: number | null
          avg_volume?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
          id?: string
          kpi_score?: number | null
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          project_id?: string
          tasks_completed?: number | null
          tasks_overdue?: number | null
          tasks_total?: number | null
          total_kpi_weight?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_kpi_summary_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_kpi_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string | null
          left_at: string | null
          project_id: string
          role: Database["public"]["Enums"]["project_member_role"] | null
          user_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          project_id: string
          role?: Database["public"]["Enums"]["project_member_role"] | null
          user_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          left_at?: string | null
          project_id?: string
          role?: Database["public"]["Enums"]["project_member_role"] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          default_milestones: Json | null
          default_phases: Json | null
          default_tasks: Json | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_milestones?: Json | null
          default_phases?: Json | null
          default_tasks?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_milestones?: Json | null
          default_phases?: Json | null
          default_tasks?: Json | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          allocation_fund: number | null
          budget: number | null
          client: string | null
          code: string
          contract_no: string | null
          created_at: string | null
          dept_id: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string | null
          manager_id: string | null
          metadata: Json | null
          name: string
          org_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["project_status"] | null
          updated_at: string | null
        }
        Insert: {
          allocation_fund?: number | null
          budget?: number | null
          client?: string | null
          code: string
          contract_no?: string | null
          created_at?: string | null
          dept_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          metadata?: Json | null
          name: string
          org_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Update: {
          allocation_fund?: number | null
          budget?: number | null
          client?: string | null
          code?: string
          contract_no?: string | null
          created_at?: string | null
          dept_id?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string | null
          manager_id?: string | null
          metadata?: Json | null
          name?: string
          org_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["project_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission_id: string
          role_id: string
          scope: string | null
        }
        Insert: {
          permission_id: string
          role_id: string
          scope?: string | null
        }
        Update: {
          permission_id?: string
          role_id?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
        ]
      }
      status_updates: {
        Row: {
          author_id: string
          blockers: Json | null
          created_at: string | null
          goal_id: string | null
          health: Database["public"]["Enums"]["health_score"]
          highlights: Json | null
          id: string
          metrics: Json | null
          next_steps: Json | null
          project_id: string | null
          published_at: string | null
          summary: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          blockers?: Json | null
          created_at?: string | null
          goal_id?: string | null
          health?: Database["public"]["Enums"]["health_score"]
          highlights?: Json | null
          id?: string
          metrics?: Json | null
          next_steps?: Json | null
          project_id?: string | null
          published_at?: string | null
          summary?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          blockers?: Json | null
          created_at?: string | null
          goal_id?: string | null
          health?: Database["public"]["Enums"]["health_score"]
          highlights?: Json | null
          id?: string
          metrics?: Json | null
          next_steps?: Json | null
          project_id?: string | null
          published_at?: string | null
          summary?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_updates_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "status_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          storage_type: string | null
          task_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          storage_type?: string | null
          task_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          storage_type?: string | null
          task_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_checklists: {
        Row: {
          created_at: string | null
          id: string
          sort_order: number | null
          task_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          sort_order?: number | null
          task_id: string
          title?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          sort_order?: number | null
          task_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_checklists_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string | null
          id: string
          task_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          task_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          task_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string | null
          dependency_type: Database["public"]["Enums"]["dependency_type"]
          depends_on_id: string
          id: string
          task_id: string
        }
        Insert: {
          created_at?: string | null
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          depends_on_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string | null
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          depends_on_id?: string
          id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_proposals: {
        Row: {
          approver_id: string
          created_at: string | null
          deadline: string | null
          dept_id: string | null
          description: string | null
          id: string
          kpi_weight: number | null
          org_id: string
          priority: Database["public"]["Enums"]["task_priority"] | null
          project_id: string | null
          proposed_by: string
          reject_reason: string | null
          start_date: string | null
          status: string
          task_id: string | null
          task_type: Database["public"]["Enums"]["task_type"] | null
          team_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          approver_id: string
          created_at?: string | null
          deadline?: string | null
          dept_id?: string | null
          description?: string | null
          id?: string
          kpi_weight?: number | null
          org_id: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          project_id?: string | null
          proposed_by: string
          reject_reason?: string | null
          start_date?: string | null
          status?: string
          task_id?: string | null
          task_type?: Database["public"]["Enums"]["task_type"] | null
          team_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          approver_id?: string
          created_at?: string | null
          deadline?: string | null
          dept_id?: string | null
          description?: string | null
          id?: string
          kpi_weight?: number | null
          org_id?: string
          priority?: Database["public"]["Enums"]["task_priority"] | null
          project_id?: string | null
          proposed_by?: string
          reject_reason?: string | null
          start_date?: string | null
          status?: string
          task_id?: string | null
          task_type?: Database["public"]["Enums"]["task_type"] | null
          team_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_proposals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_proposed_by_fkey"
            columns: ["proposed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      task_scores: {
        Row: {
          comment: string | null
          id: string
          score_type: string
          score_value: number
          scored_at: string | null
          scored_by: string
          task_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          score_type: string
          score_value: number
          scored_at?: string | null
          scored_by: string
          task_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          score_type?: string
          score_value?: number
          scored_at?: string | null
          scored_by?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_scores_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_scores_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_logs: {
        Row: {
          changed_at: string | null
          changed_by: string
          id: string
          new_status: Database["public"]["Enums"]["task_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["task_status"] | null
          task_id: string
        }
        Insert: {
          changed_at?: string | null
          changed_by: string
          id?: string
          new_status: Database["public"]["Enums"]["task_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id: string
        }
        Update: {
          changed_at?: string | null
          changed_by?: string
          id?: string
          new_status?: Database["public"]["Enums"]["task_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["task_status"] | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_status_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          category: string | null
          created_at: string | null
          created_by: string | null
          default_checklist: Json | null
          default_estimate_hours: number | null
          default_expect_difficulty: number | null
          default_expect_quality: number | null
          default_kpi_weight: number | null
          default_priority: Database["public"]["Enums"]["task_priority"] | null
          default_tags: Json | null
          default_title: string | null
          default_type: Database["public"]["Enums"]["task_type"] | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          org_id: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_checklist?: Json | null
          default_estimate_hours?: number | null
          default_expect_difficulty?: number | null
          default_expect_quality?: number | null
          default_kpi_weight?: number | null
          default_priority?: Database["public"]["Enums"]["task_priority"] | null
          default_tags?: Json | null
          default_title?: string | null
          default_type?: Database["public"]["Enums"]["task_type"] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          org_id: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          default_checklist?: Json | null
          default_estimate_hours?: number | null
          default_expect_difficulty?: number | null
          default_expect_quality?: number | null
          default_kpi_weight?: number | null
          default_priority?: Database["public"]["Enums"]["task_priority"] | null
          default_tags?: Json | null
          default_title?: string | null
          default_type?: Database["public"]["Enums"]["task_type"] | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          org_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      task_workflow_state: {
        Row: {
          completed_at: string | null
          completed_by: string | null
          current_step_id: string
          entered_at: string | null
          id: string
          note: string | null
          result: string | null
          task_id: string
          template_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_by?: string | null
          current_step_id: string
          entered_at?: string | null
          id?: string
          note?: string | null
          result?: string | null
          task_id: string
          template_id: string
        }
        Update: {
          completed_at?: string | null
          completed_by?: string | null
          current_step_id?: string
          entered_at?: string | null
          id?: string
          note?: string | null
          result?: string | null
          task_id?: string
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_workflow_state_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_workflow_state_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_workflow_state_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_workflow_state_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          actual_ahead: number | null
          actual_difficulty: number | null
          actual_hours: number | null
          actual_quality: number | null
          actual_score: number | null
          actual_volume: number | null
          allocation_id: string | null
          assignee_id: string | null
          assigner_id: string
          completed_at: string | null
          created_at: string | null
          deadline: string | null
          dept_id: string | null
          description: string | null
          estimate_hours: number | null
          expect_ahead: number | null
          expect_difficulty: number | null
          expect_quality: number | null
          expect_score: number | null
          expect_volume: number | null
          goal_id: string | null
          health: Database["public"]["Enums"]["health_score"] | null
          id: string
          is_milestone: boolean | null
          is_recurring: boolean | null
          kpi_evaluated_at: string | null
          kpi_evaluated_by: string | null
          kpi_note: string | null
          kpi_variance: number | null
          kpi_weight: number
          metadata: Json | null
          milestone_id: string | null
          org_id: string
          parent_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          progress: number
          project_id: string | null
          recurrence: Database["public"]["Enums"]["recurrence_type"] | null
          recurrence_end: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["task_status"]
          task_type: Database["public"]["Enums"]["task_type"]
          team_id: string | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          actual_ahead?: number | null
          actual_difficulty?: number | null
          actual_hours?: number | null
          actual_quality?: number | null
          actual_score?: number | null
          actual_volume?: number | null
          allocation_id?: string | null
          assignee_id?: string | null
          assigner_id: string
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          dept_id?: string | null
          description?: string | null
          estimate_hours?: number | null
          expect_ahead?: number | null
          expect_difficulty?: number | null
          expect_quality?: number | null
          expect_score?: number | null
          expect_volume?: number | null
          goal_id?: string | null
          health?: Database["public"]["Enums"]["health_score"] | null
          id?: string
          is_milestone?: boolean | null
          is_recurring?: boolean | null
          kpi_evaluated_at?: string | null
          kpi_evaluated_by?: string | null
          kpi_note?: string | null
          kpi_variance?: number | null
          kpi_weight?: number
          metadata?: Json | null
          milestone_id?: string | null
          org_id: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          recurrence_end?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          team_id?: string | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          actual_ahead?: number | null
          actual_difficulty?: number | null
          actual_hours?: number | null
          actual_quality?: number | null
          actual_score?: number | null
          actual_volume?: number | null
          allocation_id?: string | null
          assignee_id?: string | null
          assigner_id?: string
          completed_at?: string | null
          created_at?: string | null
          deadline?: string | null
          dept_id?: string | null
          description?: string | null
          estimate_hours?: number | null
          expect_ahead?: number | null
          expect_difficulty?: number | null
          expect_quality?: number | null
          expect_score?: number | null
          expect_volume?: number | null
          goal_id?: string | null
          health?: Database["public"]["Enums"]["health_score"] | null
          id?: string
          is_milestone?: boolean | null
          is_recurring?: boolean | null
          kpi_evaluated_at?: string | null
          kpi_evaluated_by?: string | null
          kpi_note?: string | null
          kpi_variance?: number | null
          kpi_weight?: number
          metadata?: Json | null
          milestone_id?: string | null
          org_id?: string
          parent_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          progress?: number
          project_id?: string | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          recurrence_end?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          task_type?: Database["public"]["Enums"]["task_type"]
          team_id?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_task_alloc"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocation_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigner_id_fkey"
            columns: ["assigner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_kpi_evaluated_by_fkey"
            columns: ["kpi_evaluated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_task_id_fkey"
            columns: ["parent_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          code: string | null
          created_at: string | null
          dept_id: string
          description: string | null
          id: string
          is_active: boolean | null
          leader_id: string | null
          name: string
          org_id: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          dept_id: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          name: string
          org_id: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          dept_id?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          leader_id?: string | null
          name?: string
          org_id?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          created_at: string | null
          description: string | null
          duration_minutes: number
          end_time: string | null
          id: string
          is_billable: boolean | null
          start_time: string | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_minutes: number
          end_time?: string | null
          id?: string
          is_billable?: boolean | null
          start_time?: string | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_minutes?: number
          end_time?: string | null
          id?: string
          is_billable?: boolean | null
          start_time?: string | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          dept_id: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          dept_id?: string | null
          email: string
          expires_at: string
          id?: string
          invited_by: string
          org_id: string
          role?: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          dept_id?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_sessions: {
        Row: {
          created_at: string | null
          device_info: Json | null
          expires_at: string
          id: string
          ip_address: unknown
          last_active: string | null
          status: Database["public"]["Enums"]["session_status"] | null
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          device_info?: Json | null
          expires_at: string
          id?: string
          ip_address?: unknown
          last_active?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          device_info?: Json | null
          expires_at?: string
          id?: string
          ip_address?: unknown
          last_active?: string | null
          status?: Database["public"]["Enums"]["session_status"] | null
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          activated_at: string | null
          avatar_url: string | null
          center_id: string | null
          created_at: string | null
          custom_role_id: string | null
          dept_id: string | null
          email: string
          failed_login_count: number | null
          full_name: string
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          job_title: string | null
          last_login: string | null
          locked_until: string | null
          login_count: number | null
          org_id: string
          password_changed_at: string | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          settings: Json | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          activated_at?: string | null
          avatar_url?: string | null
          center_id?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          dept_id?: string | null
          email: string
          failed_login_count?: number | null
          full_name: string
          id: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          job_title?: string | null
          last_login?: string | null
          locked_until?: string | null
          login_count?: number | null
          org_id: string
          password_changed_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          activated_at?: string | null
          avatar_url?: string | null
          center_id?: string | null
          created_at?: string | null
          custom_role_id?: string | null
          dept_id?: string | null
          email?: string
          failed_login_count?: number | null
          full_name?: string
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          job_title?: string | null
          last_login?: string | null
          locked_until?: string | null
          login_count?: number | null
          org_id?: string
          password_changed_at?: string | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          settings?: Json | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_center"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_custom_role"
            columns: ["custom_role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_invited"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_user_team"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_history: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          data: Json | null
          id: string
          note: string | null
          step_id: string
          task_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          note?: string | null
          step_id: string
          task_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          data?: Json | null
          id?: string
          note?: string | null
          step_id?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_history_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          assigned_custom_role: string | null
          assigned_role: Database["public"]["Enums"]["user_role"] | null
          assigned_user_id: string | null
          color: string | null
          description: string | null
          id: string
          is_automatic: boolean | null
          name: string
          on_complete_actions: Json | null
          sla_action: string | null
          sla_hours: number | null
          sort_order: number | null
          step_order: number
          step_type: Database["public"]["Enums"]["workflow_step_type"]
          template_id: string
          transition_condition: Json | null
        }
        Insert: {
          assigned_custom_role?: string | null
          assigned_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_user_id?: string | null
          color?: string | null
          description?: string | null
          id?: string
          is_automatic?: boolean | null
          name: string
          on_complete_actions?: Json | null
          sla_action?: string | null
          sla_hours?: number | null
          sort_order?: number | null
          step_order: number
          step_type: Database["public"]["Enums"]["workflow_step_type"]
          template_id: string
          transition_condition?: Json | null
        }
        Update: {
          assigned_custom_role?: string | null
          assigned_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_user_id?: string | null
          color?: string | null
          description?: string | null
          id?: string
          is_automatic?: boolean | null
          name?: string
          on_complete_actions?: Json | null
          sla_action?: string | null
          sla_hours?: number | null
          sort_order?: number | null
          step_order?: number
          step_type?: Database["public"]["Enums"]["workflow_step_type"]
          template_id?: string
          transition_condition?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_assigned_custom_role_fkey"
            columns: ["assigned_custom_role"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          dept_id: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          org_id: string
          project_id: string | null
          scope: Database["public"]["Enums"]["workflow_scope"]
          task_type_filter: Database["public"]["Enums"]["task_type"] | null
          updated_at: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          dept_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          org_id: string
          project_id?: string | null
          scope?: Database["public"]["Enums"]["workflow_scope"]
          task_type_filter?: Database["public"]["Enums"]["task_type"] | null
          updated_at?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          dept_id?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          org_id?: string
          project_id?: string | null
          scope?: Database["public"]["Enums"]["workflow_scope"]
          task_type_filter?: Database["public"]["Enums"]["task_type"] | null
          updated_at?: string | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_templates_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          condition_expr: Json | null
          condition_type: string | null
          from_step_id: string
          id: string
          label: string | null
          template_id: string
          to_step_id: string
        }
        Insert: {
          condition_expr?: Json | null
          condition_type?: string | null
          from_step_id: string
          id?: string
          label?: string | null
          template_id: string
          to_step_id: string
        }
        Update: {
          condition_expr?: Json | null
          condition_type?: string | null
          from_step_id?: string
          id?: string
          label?: string | null
          template_id?: string
          to_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_to_step_id_fkey"
            columns: ["to_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_allocate_smart: {
        Args: { p_period_id: string; p_use_actual?: boolean }
        Returns: Json
      }
      fn_evaluate_task_kpi: {
        Args: {
          p_ahd?: number
          p_diff?: number
          p_eval: string
          p_note?: string
          p_qual?: number
          p_task: string
          p_vol?: number
        }
        Returns: Json
      }
      fn_get_setting: {
        Args: { p_cat: string; p_key: string; p_org: string }
        Returns: Json
      }
      fn_has_permission: {
        Args: { p_perm: string; p_user: string }
        Returns: boolean
      }
      fn_workflow_advance: {
        Args: {
          p_actor: string
          p_note?: string
          p_result?: string
          p_task: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_center_id: { Args: never; Returns: string }
      user_dept_id: { Args: never; Returns: string }
      user_org_id: { Args: never; Returns: string }
      user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      user_team_id: { Args: never; Returns: string }
    }
    Enums: {
      allocation_mode: "per_project" | "global"
      allocation_status:
        | "draft"
        | "calculated"
        | "approved"
        | "paid"
        | "rejected"
      audit_action:
        | "login"
        | "logout"
        | "create"
        | "update"
        | "delete"
        | "approve"
        | "reject"
        | "export"
        | "password_change"
        | "role_change"
      dependency_type: "blocking" | "waiting_on" | "related"
      goal_status:
        | "on_track"
        | "at_risk"
        | "off_track"
        | "achieved"
        | "cancelled"
      goal_type: "company" | "center" | "department" | "team" | "personal"
      health_score: "green" | "yellow" | "red" | "gray"
      milestone_status: "upcoming" | "reached" | "missed"
      notification_type:
        | "task_assigned"
        | "task_updated"
        | "task_overdue"
        | "task_completed"
        | "task_review"
        | "kpi_report"
        | "allocation_approved"
        | "system"
        | "workflow_pending"
        | "kpi_evaluated"
        | "task_proposal"
        | "proposal_approved"
        | "proposal_rejected"
      period_type: "week" | "month" | "quarter" | "year"
      project_member_role: "manager" | "leader" | "engineer" | "reviewer"
      project_status:
        | "planning"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      recurrence_type: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly"
      session_status: "active" | "expired" | "revoked"
      target_type:
        | "number"
        | "currency"
        | "percentage"
        | "boolean"
        | "task_completion"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "pending"
        | "in_progress"
        | "review"
        | "completed"
        | "overdue"
        | "cancelled"
      task_type: "task" | "product"
      user_role:
        | "admin"
        | "leader"
        | "director"
        | "head"
        | "team_leader"
        | "staff"
      workflow_scope: "global" | "department" | "project" | "task_type"
      workflow_step_type:
        | "create"
        | "assign"
        | "execute"
        | "submit"
        | "review"
        | "approve"
        | "reject"
        | "revise"
        | "calculate"
        | "notify"
        | "archive"
        | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      allocation_mode: ["per_project", "global"],
      allocation_status: [
        "draft",
        "calculated",
        "approved",
        "paid",
        "rejected",
      ],
      audit_action: [
        "login",
        "logout",
        "create",
        "update",
        "delete",
        "approve",
        "reject",
        "export",
        "password_change",
        "role_change",
      ],
      dependency_type: ["blocking", "waiting_on", "related"],
      goal_status: [
        "on_track",
        "at_risk",
        "off_track",
        "achieved",
        "cancelled",
      ],
      goal_type: ["company", "center", "department", "team", "personal"],
      health_score: ["green", "yellow", "red", "gray"],
      milestone_status: ["upcoming", "reached", "missed"],
      notification_type: [
        "task_assigned",
        "task_updated",
        "task_overdue",
        "task_completed",
        "task_review",
        "kpi_report",
        "allocation_approved",
        "system",
        "workflow_pending",
        "kpi_evaluated",
        "task_proposal",
        "proposal_approved",
        "proposal_rejected",
      ],
      period_type: ["week", "month", "quarter", "year"],
      project_member_role: ["manager", "leader", "engineer", "reviewer"],
      project_status: ["planning", "active", "paused", "completed", "archived"],
      recurrence_type: ["daily", "weekly", "biweekly", "monthly", "quarterly"],
      session_status: ["active", "expired", "revoked"],
      target_type: [
        "number",
        "currency",
        "percentage",
        "boolean",
        "task_completion",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "pending",
        "in_progress",
        "review",
        "completed",
        "overdue",
        "cancelled",
      ],
      task_type: ["task", "product"],
      user_role: [
        "admin",
        "leader",
        "director",
        "head",
        "team_leader",
        "staff",
      ],
      workflow_scope: ["global", "department", "project", "task_type"],
      workflow_step_type: [
        "create",
        "assign",
        "execute",
        "submit",
        "review",
        "approve",
        "reject",
        "revise",
        "calculate",
        "notify",
        "archive",
        "custom",
      ],
    },
  },
} as const
