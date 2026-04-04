export type NotificationType =
  | "task_assigned"
  | "task_completed"
  | "task_overdue"
  | "task_comment"
  | "kpi_evaluated"
  | "allocation_approved"
  | "allocation_paid"
  | "workflow_pending"
  | "workflow_advanced"
  | "mention"
  | "project_update"
  | "task_proposal"
  | "proposal_approved"
  | "proposal_rejected"
  | "system";

export interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: NotificationType;
  data: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export interface NotificationGroup {
  label: string;
  items: NotificationItem[];
}

export const NOTIFICATION_TYPE_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  task_assigned: { icon: "📋", color: "#3b82f6", label: "Giao việc" },
  task_completed: { icon: "✅", color: "#10b981", label: "Hoàn thành" },
  task_overdue: { icon: "⏰", color: "#ef4444", label: "Quá hạn" },
  task_comment: { icon: "💬", color: "#8b5cf6", label: "Bình luận" },
  kpi_evaluated: { icon: "🎯", color: "#f59e0b", label: "Nghiệm thu" },
  allocation_approved: { icon: "💰", color: "#10b981", label: "Duyệt khoán" },
  allocation_paid: { icon: "💸", color: "#6366f1", label: "Chi khoán" },
  workflow_pending: { icon: "⚡", color: "#f59e0b", label: "Chờ duyệt" },
  workflow_advanced: { icon: "→", color: "#3b82f6", label: "Workflow" },
  mention: { icon: "@", color: "#ec4899", label: "Nhắc đến" },
  project_update: { icon: "🏗️", color: "#06b6d4", label: "Dự án" },
  task_proposal: { icon: "📝", color: "#8b5cf6", label: "Đề xuất" },
  proposal_approved: { icon: "✅", color: "#10b981", label: "Đề xuất duyệt" },
  proposal_rejected: { icon: "❌", color: "#ef4444", label: "Đề xuất từ chối" },
  system: { icon: "⚙️", color: "#94a3b8", label: "Hệ thống" },
};
