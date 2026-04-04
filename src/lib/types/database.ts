export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      allocation_configs: {
        Row: {
          id: string
          org_id: string
          name: string
          weight_volume: number
          weight_quality: number
          weight_difficulty: number
          weight_ahead: number
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name?: string
          weight_volume?: number
          weight_quality?: number
          weight_difficulty?: number
          weight_ahead?: number
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          weight_volume?: number
          weight_quality?: number
          weight_difficulty?: number
          weight_ahead?: number
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
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
          id: string
          org_id: string
          config_id: string
          name: string
          project_id: string | null
          dept_id: string | null
          total_fund: number
          period_start: string
          period_end: string
          mode: Database["public"]["Enums"]["allocation_mode"]
          status: Database["public"]["Enums"]["allocation_status"]
          approved_by: string | null
          approved_at: string | null
          notes: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          config_id: string
          name: string
          project_id?: string | null
          dept_id?: string | null
          total_fund: number
          period_start: string
          period_end: string
          mode?: Database["public"]["Enums"]["allocation_mode"]
          status?: Database["public"]["Enums"]["allocation_status"]
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          config_id?: string
          name?: string
          project_id?: string | null
          dept_id?: string | null
          total_fund?: number
          period_start?: string
          period_end?: string
          mode?: Database["public"]["Enums"]["allocation_mode"]
          status?: Database["public"]["Enums"]["allocation_status"]
          approved_by?: string | null
          approved_at?: string | null
          notes?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "allocation_periods_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "allocation_periods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            foreignKeyName: "allocation_periods_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      allocation_results: {
        Row: {
          id: string
          period_id: string
          user_id: string
          project_id: string | null
          mode: Database["public"]["Enums"]["allocation_mode"]
          avg_volume: number | null
          avg_quality: number | null
          avg_difficulty: number | null
          avg_ahead: number | null
          weighted_score: number | null
          share_percentage: number | null
          allocated_amount: number | null
          task_count: number | null
          breakdown: Json | null
          calculated_at: string | null
        }
        Insert: {
          id?: string
          period_id: string
          user_id: string
          project_id?: string | null
          mode?: Database["public"]["Enums"]["allocation_mode"]
          avg_volume?: number | null
          avg_quality?: number | null
          avg_difficulty?: number | null
          avg_ahead?: number | null
          weighted_score?: number | null
          share_percentage?: number | null
          allocated_amount?: number | null
          task_count?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
        }
        Update: {
          id?: string
          period_id?: string
          user_id?: string
          project_id?: string | null
          mode?: Database["public"]["Enums"]["allocation_mode"]
          avg_volume?: number | null
          avg_quality?: number | null
          avg_difficulty?: number | null
          avg_ahead?: number | null
          weighted_score?: number | null
          share_percentage?: number | null
          allocated_amount?: number | null
          task_count?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
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
            foreignKeyName: "allocation_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "allocation_results_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          action: Database["public"]["Enums"]["audit_action"]
          resource_type: string
          resource_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          action: Database["public"]["Enums"]["audit_action"]
          resource_type: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string | null
          action?: Database["public"]["Enums"]["audit_action"]
          resource_type?: string
          resource_id?: string | null
          old_values?: Json | null
          new_values?: Json | null
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string | null
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
          id: string
          rule_id: string
          trigger_data: Json | null
          actions_executed: Json | null
          success: boolean | null
          error: string | null
          executed_at: string | null
        }
        Insert: {
          id?: string
          rule_id: string
          trigger_data?: Json | null
          actions_executed?: Json | null
          success?: boolean | null
          error?: string | null
          executed_at?: string | null
        }
        Update: {
          id?: string
          rule_id?: string
          trigger_data?: Json | null
          actions_executed?: Json | null
          success?: boolean | null
          error?: string | null
          executed_at?: string | null
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
          id: string
          org_id: string
          name: string
          description: string | null
          trigger_type: string
          trigger_config: Json
          conditions: Json | null
          actions: Json
          project_id: string | null
          is_active: boolean | null
          run_count: number | null
          last_run_at: string | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          trigger_type: string
          trigger_config?: Json
          conditions?: Json | null
          actions?: Json
          project_id?: string | null
          is_active?: boolean | null
          run_count?: number | null
          last_run_at?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          trigger_type?: string
          trigger_config?: Json
          conditions?: Json | null
          actions?: Json
          project_id?: string | null
          is_active?: boolean | null
          run_count?: number | null
          last_run_at?: string | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "automation_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      centers: {
        Row: {
          id: string
          org_id: string
          name: string
          code: string | null
          description: string | null
          director_id: string | null
          is_active: boolean | null
          sort_order: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          code?: string | null
          description?: string | null
          director_id?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          code?: string | null
          description?: string | null
          director_id?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "centers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "centers_director_id_fkey"
            columns: ["director_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          id: string
          checklist_id: string
          content: string
          is_checked: boolean | null
          assignee_id: string | null
          due_date: string | null
          sort_order: number | null
          checked_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          checklist_id: string
          content: string
          is_checked?: boolean | null
          assignee_id?: string | null
          due_date?: string | null
          sort_order?: number | null
          checked_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          checklist_id?: string
          content?: string
          is_checked?: boolean | null
          assignee_id?: string | null
          due_date?: string | null
          sort_order?: number | null
          checked_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_checklist_id_fkey"
            columns: ["checklist_id"]
            isOneToOne: false
            referencedRelation: "task_checklists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_roles: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          color: string | null
          base_role: Database["public"]["Enums"]["user_role"]
          is_system: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          color?: string | null
          base_role?: Database["public"]["Enums"]["user_role"]
          is_system?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          color?: string | null
          base_role?: Database["public"]["Enums"]["user_role"]
          is_system?: boolean | null
          created_at?: string | null
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
          id: string
          dashboard_id: string
          widget_type: string
          title: string | null
          config: Json
          position: Json
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          dashboard_id: string
          widget_type: string
          title?: string | null
          config?: Json
          position?: Json
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          dashboard_id?: string
          widget_type?: string
          title?: string | null
          config?: Json
          position?: Json
          sort_order?: number | null
          created_at?: string | null
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
          id: string
          org_id: string
          title: string
          description: string | null
          owner_id: string
          is_shared: boolean | null
          layout: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          title: string
          description?: string | null
          owner_id: string
          is_shared?: boolean | null
          layout?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          title?: string
          description?: string | null
          owner_id?: string
          is_shared?: boolean | null
          layout?: Json | null
          created_at?: string | null
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
          id: string
          org_id: string
          name: string
          code: string
          description: string | null
          head_user_id: string | null
          center_id: string | null
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          code: string
          description?: string | null
          head_user_id?: string | null
          center_id?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          code?: string
          description?: string | null
          head_user_id?: string | null
          center_id?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "departments_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          id: string
          form_id: string
          submitted_by: string | null
          data: Json
          task_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          form_id: string
          submitted_by?: string | null
          data: Json
          task_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          submitted_by?: string | null
          data?: Json
          task_id?: string | null
          created_at?: string | null
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
          id: string
          org_id: string
          user_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          projects_count: number | null
          tasks_total: number | null
          tasks_completed: number | null
          tasks_overdue: number | null
          avg_volume: number | null
          avg_quality: number | null
          avg_difficulty: number | null
          avg_ahead: number | null
          kpi_score: number | null
          project_breakdown: Json | null
          calculated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          projects_count?: number | null
          tasks_total?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          avg_volume?: number | null
          avg_quality?: number | null
          avg_difficulty?: number | null
          avg_ahead?: number | null
          kpi_score?: number | null
          project_breakdown?: Json | null
          calculated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          projects_count?: number | null
          tasks_total?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          avg_volume?: number | null
          avg_quality?: number | null
          avg_difficulty?: number | null
          avg_ahead?: number | null
          kpi_score?: number | null
          project_breakdown?: Json | null
          calculated_at?: string | null
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
          id: string
          goal_id: string
          title: string
          target_type: Database["public"]["Enums"]["target_type"]
          start_value: number | null
          current_value: number | null
          target_value: number
          unit: string | null
          is_completed: boolean | null
          completed_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          goal_id: string
          title: string
          target_type?: Database["public"]["Enums"]["target_type"]
          start_value?: number | null
          current_value?: number | null
          target_value: number
          unit?: string | null
          is_completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          goal_id?: string
          title?: string
          target_type?: Database["public"]["Enums"]["target_type"]
          start_value?: number | null
          current_value?: number | null
          target_value?: number
          unit?: string | null
          is_completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
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
          id: string
          org_id: string
          parent_goal_id: string | null
          title: string
          description: string | null
          goal_type: Database["public"]["Enums"]["goal_type"]
          status: Database["public"]["Enums"]["goal_status"]
          owner_id: string | null
          dept_id: string | null
          period_label: string | null
          start_date: string | null
          due_date: string | null
          progress: number | null
          progress_source: string | null
          is_public: boolean | null
          color: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          parent_goal_id?: string | null
          title: string
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          status?: Database["public"]["Enums"]["goal_status"]
          owner_id?: string | null
          dept_id?: string | null
          period_label?: string | null
          start_date?: string | null
          due_date?: string | null
          progress?: number | null
          progress_source?: string | null
          is_public?: boolean | null
          color?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          parent_goal_id?: string | null
          title?: string
          description?: string | null
          goal_type?: Database["public"]["Enums"]["goal_type"]
          status?: Database["public"]["Enums"]["goal_status"]
          owner_id?: string | null
          dept_id?: string | null
          period_label?: string | null
          start_date?: string | null
          due_date?: string | null
          progress?: number | null
          progress_source?: string | null
          is_public?: boolean | null
          color?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
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
            foreignKeyName: "goals_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      intake_forms: {
        Row: {
          id: string
          org_id: string
          title: string
          description: string | null
          target_project_id: string | null
          target_dept_id: string | null
          auto_assign_to: string | null
          default_priority: Database["public"]["Enums"]["task_priority"]
          fields: Json
          is_active: boolean | null
          is_public: boolean | null
          submission_count: number | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          title: string
          description?: string | null
          target_project_id?: string | null
          target_dept_id?: string | null
          auto_assign_to?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"]
          fields?: Json
          is_active?: boolean | null
          is_public?: boolean | null
          submission_count?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          title?: string
          description?: string | null
          target_project_id?: string | null
          target_dept_id?: string | null
          auto_assign_to?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"]
          fields?: Json
          is_active?: boolean | null
          is_public?: boolean | null
          submission_count?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "intake_forms_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intake_forms_target_project_id_fkey"
            columns: ["target_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
        ]
      }
      kpi_configs: {
        Row: {
          id: string
          org_id: string
          progress_weight: number | null
          ontime_weight: number | null
          volume_weight: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          progress_weight?: number | null
          ontime_weight?: number | null
          volume_weight?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          progress_weight?: number | null
          ontime_weight?: number | null
          volume_weight?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kpi_configs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_records: {
        Row: {
          id: string
          org_id: string
          user_id: string | null
          dept_id: string | null
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          period_end: string
          tasks_assigned: number | null
          tasks_completed: number | null
          tasks_overdue: number | null
          tasks_on_time: number | null
          score: number | null
          breakdown: Json | null
          calculated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id?: string | null
          dept_id?: string | null
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          period_end: string
          tasks_assigned?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          tasks_on_time?: number | null
          score?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string | null
          dept_id?: string | null
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          period_end?: string
          tasks_assigned?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          tasks_on_time?: number | null
          score?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "kpi_records_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          id: string
          project_id: string
          title: string
          description: string | null
          due_date: string
          status: Database["public"]["Enums"]["milestone_status"]
          reached_at: string | null
          goal_id: string | null
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          title: string
          description?: string | null
          due_date: string
          status?: Database["public"]["Enums"]["milestone_status"]
          reached_at?: string | null
          goal_id?: string | null
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          title?: string
          description?: string | null
          due_date?: string
          status?: Database["public"]["Enums"]["milestone_status"]
          reached_at?: string | null
          goal_id?: string | null
          sort_order?: number | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          id: string
          org_id: string
          user_id: string
          title: string
          body: string | null
          type: Database["public"]["Enums"]["notification_type"]
          data: Json | null
          is_read: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          title: string
          body?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          data?: Json | null
          is_read?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          user_id?: string
          title?: string
          body?: string | null
          type?: Database["public"]["Enums"]["notification_type"]
          data?: Json | null
          is_read?: boolean | null
          created_at?: string | null
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
          id: string
          org_id: string
          category: string
          key: string
          value: Json
          description: string | null
          updated_by: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          category: string
          key: string
          value: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          category?: string
          key?: string
          value?: Json
          description?: string | null
          updated_by?: string | null
          updated_at?: string | null
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
          id: string
          name: string
          domain: string | null
          logo_url: string | null
          settings: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          domain?: string | null
          logo_url?: string | null
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          domain?: string | null
          logo_url?: string | null
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      permissions: {
        Row: {
          id: string
          group_name: string
          name: string
          description: string | null
          sort_order: number | null
        }
        Insert: {
          id: string
          group_name: string
          name: string
          description?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          group_name?: string
          name?: string
          description?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      project_departments: {
        Row: {
          project_id: string
          dept_id: string
          created_at: string | null
        }
        Insert: {
          project_id: string
          dept_id: string
          created_at?: string | null
        }
        Update: {
          project_id?: string
          dept_id?: string
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_departments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_departments_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      project_kpi_summary: {
        Row: {
          id: string
          project_id: string
          user_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          tasks_total: number | null
          tasks_completed: number | null
          tasks_overdue: number | null
          total_kpi_weight: number | null
          avg_volume: number | null
          avg_quality: number | null
          avg_difficulty: number | null
          avg_ahead: number | null
          kpi_score: number | null
          breakdown: Json | null
          calculated_at: string | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          tasks_total?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          total_kpi_weight?: number | null
          avg_volume?: number | null
          avg_quality?: number | null
          avg_difficulty?: number | null
          avg_ahead?: number | null
          kpi_score?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          tasks_total?: number | null
          tasks_completed?: number | null
          tasks_overdue?: number | null
          total_kpi_weight?: number | null
          avg_volume?: number | null
          avg_quality?: number | null
          avg_difficulty?: number | null
          avg_ahead?: number | null
          kpi_score?: number | null
          breakdown?: Json | null
          calculated_at?: string | null
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
          project_id: string
          user_id: string
          role: Database["public"]["Enums"]["project_member_role"]
          joined_at: string | null
          left_at: string | null
          is_active: boolean | null
        }
        Insert: {
          id?: string
          project_id: string
          user_id: string
          role?: Database["public"]["Enums"]["project_member_role"]
          joined_at?: string | null
          left_at?: string | null
          is_active?: boolean | null
        }
        Update: {
          id?: string
          project_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["project_member_role"]
          joined_at?: string | null
          left_at?: string | null
          is_active?: boolean | null
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
          id: string
          org_id: string
          name: string
          description: string | null
          category: string | null
          default_tasks: Json | null
          default_milestones: Json | null
          default_phases: Json | null
          is_active: boolean | null
          created_by: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          category?: string | null
          default_tasks?: Json | null
          default_milestones?: Json | null
          default_phases?: Json | null
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          category?: string | null
          default_tasks?: Json | null
          default_milestones?: Json | null
          default_phases?: Json | null
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          id: string
          org_id: string
          code: string
          name: string
          description: string | null
          dept_id: string | null
          manager_id: string | null
          status: Database["public"]["Enums"]["project_status"]
          budget: number | null
          allocation_fund: number | null
          start_date: string | null
          end_date: string | null
          location: string | null
          client: string | null
          contract_no: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          code: string
          name: string
          description?: string | null
          dept_id?: string | null
          manager_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          budget?: number | null
          allocation_fund?: number | null
          start_date?: string | null
          end_date?: string | null
          location?: string | null
          client?: string | null
          contract_no?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          code?: string
          name?: string
          description?: string | null
          dept_id?: string | null
          manager_id?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          budget?: number | null
          allocation_fund?: number | null
          start_date?: string | null
          end_date?: string | null
          location?: string | null
          client?: string | null
          contract_no?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
        ]
      }
      role_permissions: {
        Row: {
          role_id: string
          permission_id: string
          scope: string | null
        }
        Insert: {
          role_id: string
          permission_id: string
          scope?: string | null
        }
        Update: {
          role_id?: string
          permission_id?: string
          scope?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "custom_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      status_updates: {
        Row: {
          id: string
          project_id: string | null
          goal_id: string | null
          title: string
          summary: string | null
          health: Database["public"]["Enums"]["health_score"]
          highlights: Json | null
          blockers: Json | null
          next_steps: Json | null
          metrics: Json | null
          author_id: string
          published_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          goal_id?: string | null
          title: string
          summary?: string | null
          health?: Database["public"]["Enums"]["health_score"]
          highlights?: Json | null
          blockers?: Json | null
          next_steps?: Json | null
          metrics?: Json | null
          author_id: string
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          goal_id?: string | null
          title?: string
          summary?: string | null
          health?: Database["public"]["Enums"]["health_score"]
          highlights?: Json | null
          blockers?: Json | null
          next_steps?: Json | null
          metrics?: Json | null
          author_id?: string
          published_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "status_updates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            foreignKeyName: "status_updates_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          id: string
          task_id: string
          uploaded_by: string
          file_name: string
          file_url: string
          file_size: number | null
          mime_type: string | null
          storage_type: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          uploaded_by: string
          file_name: string
          file_url: string
          file_size?: number | null
          mime_type?: string | null
          storage_type?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          uploaded_by?: string
          file_name?: string
          file_url?: string
          file_size?: number | null
          mime_type?: string | null
          storage_type?: string | null
          created_at?: string | null
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
          id: string
          task_id: string
          title: string
          sort_order: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          title?: string
          sort_order?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          title?: string
          sort_order?: number | null
          created_at?: string | null
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
          id: string
          task_id: string
          user_id: string
          content: string
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          content: string
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          content?: string
          created_at?: string | null
          updated_at?: string | null
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
          id: string
          task_id: string
          depends_on_id: string
          dependency_type: Database["public"]["Enums"]["dependency_type"]
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          depends_on_id: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          depends_on_id?: string
          dependency_type?: Database["public"]["Enums"]["dependency_type"]
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_depends_on_id_fkey"
            columns: ["depends_on_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_proposals: {
        Row: {
          id: string
          org_id: string
          proposed_by: string
          approver_id: string
          title: string
          description: string | null
          project_id: string | null
          dept_id: string | null
          team_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          task_type: Database["public"]["Enums"]["task_type"]
          kpi_weight: number | null
          start_date: string | null
          deadline: string | null
          status: string
          reject_reason: string | null
          task_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          proposed_by: string
          approver_id: string
          title: string
          description?: string | null
          project_id?: string | null
          dept_id?: string | null
          team_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          task_type?: Database["public"]["Enums"]["task_type"]
          kpi_weight?: number | null
          start_date?: string | null
          deadline?: string | null
          status?: string
          reject_reason?: string | null
          task_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          proposed_by?: string
          approver_id?: string
          title?: string
          description?: string | null
          project_id?: string | null
          dept_id?: string | null
          team_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          task_type?: Database["public"]["Enums"]["task_type"]
          kpi_weight?: number | null
          start_date?: string | null
          deadline?: string | null
          status?: string
          reject_reason?: string | null
          task_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_proposals_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "task_proposals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
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
            foreignKeyName: "task_proposals_dept_id_fkey"
            columns: ["dept_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_proposals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_scores: {
        Row: {
          id: string
          task_id: string
          scored_by: string
          score_type: string
          score_value: number
          comment: string | null
          scored_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          scored_by: string
          score_type: string
          score_value: number
          comment?: string | null
          scored_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          scored_by?: string
          score_type?: string
          score_value?: number
          comment?: string | null
          scored_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_scores_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_scores_scored_by_fkey"
            columns: ["scored_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_status_logs: {
        Row: {
          id: string
          task_id: string
          changed_by: string
          old_status: Database["public"]["Enums"]["task_status"] | null
          new_status: Database["public"]["Enums"]["task_status"]
          note: string | null
          changed_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          changed_by: string
          old_status?: Database["public"]["Enums"]["task_status"] | null
          new_status: Database["public"]["Enums"]["task_status"]
          note?: string | null
          changed_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          changed_by?: string
          old_status?: Database["public"]["Enums"]["task_status"] | null
          new_status?: Database["public"]["Enums"]["task_status"]
          note?: string | null
          changed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_status_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_status_logs_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          category: string | null
          default_title: string | null
          default_priority: Database["public"]["Enums"]["task_priority"]
          default_type: Database["public"]["Enums"]["task_type"]
          default_kpi_weight: number | null
          default_estimate_hours: number | null
          default_expect_quality: number | null
          default_expect_difficulty: number | null
          default_checklist: Json | null
          default_tags: Json | null
          is_active: boolean | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          category?: string | null
          default_title?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"]
          default_type?: Database["public"]["Enums"]["task_type"]
          default_kpi_weight?: number | null
          default_estimate_hours?: number | null
          default_expect_quality?: number | null
          default_expect_difficulty?: number | null
          default_checklist?: Json | null
          default_tags?: Json | null
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          category?: string | null
          default_title?: string | null
          default_priority?: Database["public"]["Enums"]["task_priority"]
          default_type?: Database["public"]["Enums"]["task_type"]
          default_kpi_weight?: number | null
          default_estimate_hours?: number | null
          default_expect_quality?: number | null
          default_expect_difficulty?: number | null
          default_checklist?: Json | null
          default_tags?: Json | null
          is_active?: boolean | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      task_workflow_state: {
        Row: {
          id: string
          task_id: string
          template_id: string
          current_step_id: string
          entered_at: string | null
          completed_at: string | null
          completed_by: string | null
          result: string | null
          note: string | null
        }
        Insert: {
          id?: string
          task_id: string
          template_id: string
          current_step_id: string
          entered_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          result?: string | null
          note?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          template_id?: string
          current_step_id?: string
          entered_at?: string | null
          completed_at?: string | null
          completed_by?: string | null
          result?: string | null
          note?: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "task_workflow_state_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_workflow_state_completed_by_fkey"
            columns: ["completed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          id: string
          org_id: string
          dept_id: string | null
          project_id: string | null
          title: string
          description: string | null
          assignee_id: string | null
          assigner_id: string
          status: Database["public"]["Enums"]["task_status"]
          priority: Database["public"]["Enums"]["task_priority"]
          task_type: Database["public"]["Enums"]["task_type"]
          kpi_weight: number
          progress: number
          expect_volume: number | null
          expect_quality: number | null
          expect_difficulty: number | null
          expect_ahead: number | null
          actual_volume: number | null
          actual_quality: number | null
          actual_difficulty: number | null
          actual_ahead: number | null
          expect_score: number | null
          actual_score: number | null
          kpi_variance: number | null
          kpi_evaluated_by: string | null
          kpi_evaluated_at: string | null
          kpi_note: string | null
          start_date: string | null
          deadline: string | null
          completed_at: string | null
          parent_task_id: string | null
          milestone_id: string | null
          goal_id: string | null
          allocation_id: string | null
          template_id: string | null
          team_id: string | null
          estimate_hours: number | null
          actual_hours: number | null
          health: Database["public"]["Enums"]["health_score"]
          is_milestone: boolean | null
          is_recurring: boolean | null
          recurrence: Database["public"]["Enums"]["recurrence_type"] | null
          recurrence_end: string | null
          metadata: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          dept_id?: string | null
          project_id?: string | null
          title: string
          description?: string | null
          assignee_id?: string | null
          assigner_id: string
          status?: Database["public"]["Enums"]["task_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          task_type?: Database["public"]["Enums"]["task_type"]
          kpi_weight?: number
          progress?: number
          expect_volume?: number | null
          expect_quality?: number | null
          expect_difficulty?: number | null
          expect_ahead?: number | null
          actual_volume?: number | null
          actual_quality?: number | null
          actual_difficulty?: number | null
          actual_ahead?: number | null
          kpi_evaluated_by?: string | null
          kpi_evaluated_at?: string | null
          kpi_note?: string | null
          start_date?: string | null
          deadline?: string | null
          completed_at?: string | null
          parent_task_id?: string | null
          milestone_id?: string | null
          goal_id?: string | null
          allocation_id?: string | null
          template_id?: string | null
          team_id?: string | null
          estimate_hours?: number | null
          actual_hours?: number | null
          health?: Database["public"]["Enums"]["health_score"]
          is_milestone?: boolean | null
          is_recurring?: boolean | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          recurrence_end?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          dept_id?: string | null
          project_id?: string | null
          title?: string
          description?: string | null
          assignee_id?: string | null
          assigner_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          priority?: Database["public"]["Enums"]["task_priority"]
          task_type?: Database["public"]["Enums"]["task_type"]
          kpi_weight?: number
          progress?: number
          expect_volume?: number | null
          expect_quality?: number | null
          expect_difficulty?: number | null
          expect_ahead?: number | null
          actual_volume?: number | null
          actual_quality?: number | null
          actual_difficulty?: number | null
          actual_ahead?: number | null
          kpi_evaluated_by?: string | null
          kpi_evaluated_at?: string | null
          kpi_note?: string | null
          start_date?: string | null
          deadline?: string | null
          completed_at?: string | null
          parent_task_id?: string | null
          milestone_id?: string | null
          goal_id?: string | null
          allocation_id?: string | null
          template_id?: string | null
          team_id?: string | null
          estimate_hours?: number | null
          actual_hours?: number | null
          health?: Database["public"]["Enums"]["health_score"]
          is_milestone?: boolean | null
          is_recurring?: boolean | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"] | null
          recurrence_end?: string | null
          metadata?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
            foreignKeyName: "tasks_kpi_evaluated_by_fkey"
            columns: ["kpi_evaluated_by"]
            isOneToOne: false
            referencedRelation: "users"
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
            foreignKeyName: "tasks_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "milestones"
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
            foreignKeyName: "fk_task_alloc"
            columns: ["allocation_id"]
            isOneToOne: false
            referencedRelation: "allocation_periods"
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
          id: string
          org_id: string
          dept_id: string
          name: string
          code: string | null
          description: string | null
          leader_id: string | null
          is_active: boolean | null
          sort_order: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          dept_id: string
          name: string
          code?: string | null
          description?: string | null
          leader_id?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          dept_id?: string
          name?: string
          code?: string | null
          description?: string | null
          leader_id?: string | null
          is_active?: boolean | null
          sort_order?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
        ]
      }
      time_entries: {
        Row: {
          id: string
          task_id: string
          user_id: string
          start_time: string | null
          end_time: string | null
          duration_minutes: number
          description: string | null
          is_billable: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          user_id: string
          start_time?: string | null
          end_time?: string | null
          duration_minutes: number
          description?: string | null
          is_billable?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          user_id?: string
          start_time?: string | null
          end_time?: string | null
          duration_minutes?: number
          description?: string | null
          is_billable?: boolean | null
          created_at?: string | null
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
          id: string
          org_id: string
          email: string
          role: Database["public"]["Enums"]["user_role"]
          dept_id: string | null
          invited_by: string
          token: string
          expires_at: string
          accepted_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          role?: Database["public"]["Enums"]["user_role"]
          dept_id?: string | null
          invited_by: string
          token: string
          expires_at: string
          accepted_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          email?: string
          role?: Database["public"]["Enums"]["user_role"]
          dept_id?: string | null
          invited_by?: string
          token?: string
          expires_at?: string
          accepted_at?: string | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
        ]
      }
      user_sessions: {
        Row: {
          id: string
          user_id: string
          token_hash: string
          ip_address: string | null
          user_agent: string | null
          device_info: Json | null
          status: Database["public"]["Enums"]["session_status"]
          created_at: string | null
          expires_at: string
          last_active: string | null
        }
        Insert: {
          id?: string
          user_id: string
          token_hash: string
          ip_address?: string | null
          user_agent?: string | null
          device_info?: Json | null
          status?: Database["public"]["Enums"]["session_status"]
          created_at?: string | null
          expires_at: string
          last_active?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          token_hash?: string
          ip_address?: string | null
          user_agent?: string | null
          device_info?: Json | null
          status?: Database["public"]["Enums"]["session_status"]
          created_at?: string | null
          expires_at?: string
          last_active?: string | null
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
          id: string
          org_id: string
          dept_id: string | null
          center_id: string | null
          team_id: string | null
          full_name: string
          email: string
          phone: string | null
          avatar_url: string | null
          role: Database["public"]["Enums"]["user_role"]
          job_title: string | null
          is_active: boolean | null
          custom_role_id: string | null
          invited_by: string | null
          invited_at: string | null
          activated_at: string | null
          last_login: string | null
          login_count: number | null
          failed_login_count: number | null
          locked_until: string | null
          password_changed_at: string | null
          settings: Json | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          org_id: string
          dept_id?: string | null
          center_id?: string | null
          team_id?: string | null
          full_name: string
          email: string
          phone?: string | null
          avatar_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          job_title?: string | null
          is_active?: boolean | null
          custom_role_id?: string | null
          invited_by?: string | null
          invited_at?: string | null
          activated_at?: string | null
          last_login?: string | null
          login_count?: number | null
          failed_login_count?: number | null
          locked_until?: string | null
          password_changed_at?: string | null
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          dept_id?: string | null
          center_id?: string | null
          team_id?: string | null
          full_name?: string
          email?: string
          phone?: string | null
          avatar_url?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          job_title?: string | null
          is_active?: boolean | null
          custom_role_id?: string | null
          invited_by?: string | null
          invited_at?: string | null
          activated_at?: string | null
          last_login?: string | null
          login_count?: number | null
          failed_login_count?: number | null
          locked_until?: string | null
          password_changed_at?: string | null
          settings?: Json | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "users_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
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
        ]
      }
      workflow_history: {
        Row: {
          id: string
          task_id: string
          step_id: string
          action: string
          actor_id: string | null
          note: string | null
          data: Json | null
          created_at: string | null
        }
        Insert: {
          id?: string
          task_id: string
          step_id: string
          action: string
          actor_id?: string | null
          note?: string | null
          data?: Json | null
          created_at?: string | null
        }
        Update: {
          id?: string
          task_id?: string
          step_id?: string
          action?: string
          actor_id?: string | null
          note?: string | null
          data?: Json | null
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
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
            foreignKeyName: "workflow_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_steps: {
        Row: {
          id: string
          template_id: string
          step_order: number
          name: string
          description: string | null
          step_type: Database["public"]["Enums"]["workflow_step_type"]
          assigned_role: Database["public"]["Enums"]["user_role"] | null
          assigned_custom_role: string | null
          assigned_user_id: string | null
          is_automatic: boolean | null
          transition_condition: Json | null
          sla_hours: number | null
          sla_action: string | null
          on_complete_actions: Json | null
          color: string | null
          sort_order: number | null
        }
        Insert: {
          id?: string
          template_id: string
          step_order: number
          name: string
          description?: string | null
          step_type: Database["public"]["Enums"]["workflow_step_type"]
          assigned_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_custom_role?: string | null
          assigned_user_id?: string | null
          is_automatic?: boolean | null
          transition_condition?: Json | null
          sla_hours?: number | null
          sla_action?: string | null
          on_complete_actions?: Json | null
          color?: string | null
          sort_order?: number | null
        }
        Update: {
          id?: string
          template_id?: string
          step_order?: number
          name?: string
          description?: string | null
          step_type?: Database["public"]["Enums"]["workflow_step_type"]
          assigned_role?: Database["public"]["Enums"]["user_role"] | null
          assigned_custom_role?: string | null
          assigned_user_id?: string | null
          is_automatic?: boolean | null
          transition_condition?: Json | null
          sla_hours?: number | null
          sla_action?: string | null
          on_complete_actions?: Json | null
          color?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
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
        ]
      }
      workflow_templates: {
        Row: {
          id: string
          org_id: string
          name: string
          description: string | null
          scope: Database["public"]["Enums"]["workflow_scope"]
          dept_id: string | null
          project_id: string | null
          task_type_filter: Database["public"]["Enums"]["task_type"] | null
          is_active: boolean | null
          is_default: boolean | null
          version: number | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          description?: string | null
          scope?: Database["public"]["Enums"]["workflow_scope"]
          dept_id?: string | null
          project_id?: string | null
          task_type_filter?: Database["public"]["Enums"]["task_type"] | null
          is_active?: boolean | null
          is_default?: boolean | null
          version?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          description?: string | null
          scope?: Database["public"]["Enums"]["workflow_scope"]
          dept_id?: string | null
          project_id?: string | null
          task_type_filter?: Database["public"]["Enums"]["task_type"] | null
          is_active?: boolean | null
          is_default?: boolean | null
          version?: number | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
            foreignKeyName: "workflow_templates_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_transitions: {
        Row: {
          id: string
          template_id: string
          from_step_id: string
          to_step_id: string
          condition_type: string | null
          condition_expr: Json | null
          label: string | null
        }
        Insert: {
          id?: string
          template_id: string
          from_step_id: string
          to_step_id: string
          condition_type?: string | null
          condition_expr?: Json | null
          label?: string | null
        }
        Update: {
          id?: string
          template_id?: string
          from_step_id?: string
          to_step_id?: string
          condition_type?: string | null
          condition_expr?: Json | null
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_transitions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workflow_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_transitions_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "workflow_steps"
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
      fn_evaluate_task_kpi: {
        Args: {
          p_task: string
          p_eval: string
          p_vol: number
          p_ahd: number
          p_qual: number
          p_diff: number
          p_note: string | null
        }
        Returns: undefined
      }
      fn_workflow_advance: {
        Args: {
          p_task: string
          p_actor: string
          p_result: string
          p_note: string | null
        }
        Returns: undefined
      }
      fn_allocate_smart: {
        Args: {
          p_period_id: string
          p_use_actual: boolean
        }
        Returns: undefined
      }
    }
    Enums: {
      user_role: "admin" | "leader" | "director" | "head" | "team_leader" | "staff"
      task_status: "pending" | "in_progress" | "review" | "completed" | "overdue" | "cancelled"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_type: "task" | "product"
      period_type: "week" | "month" | "quarter" | "year"
      notification_type:
        | "task_assigned"
        | "task_updated"
        | "task_overdue"
        | "task_completed"
        | "task_review"
        | "kpi_report"
        | "allocation_approved"
        | "system"
        | "task_proposal"
        | "proposal_approved"
        | "proposal_rejected"
      allocation_status: "draft" | "calculated" | "approved" | "paid" | "rejected"
      allocation_mode: "per_project" | "global"
      project_status: "planning" | "active" | "paused" | "completed" | "archived"
      project_member_role: "manager" | "leader" | "engineer" | "reviewer"
      goal_type: "company" | "center" | "department" | "team" | "personal"
      goal_status: "on_track" | "at_risk" | "off_track" | "achieved" | "cancelled"
      target_type: "number" | "currency" | "percentage" | "boolean" | "task_completion"
      milestone_status: "upcoming" | "reached" | "missed"
      health_score: "green" | "yellow" | "red" | "gray"
      dependency_type: "blocking" | "waiting_on" | "related"
      recurrence_type: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly"
      session_status: "active" | "expired" | "revoked"
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
      workflow_scope: "global" | "department" | "project" | "task_type"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
