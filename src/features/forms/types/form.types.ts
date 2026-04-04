
export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "radio"
  | "file"
  | "user_picker"
  | "project_picker"
  | "priority_picker"
  | "section_header";

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  label: string;
  field_type: FieldType;
  placeholder?: string;
  description?: string;
  is_required: boolean;
  default_value?: any;
  options?: FormFieldOption[];     // for select, multi_select, radio
  validation?: {
    min?: number;
    max?: number;
    min_length?: number;
    max_length?: number;
    pattern?: string;
  };
  sort_order: number;
}


export interface IntakeForm {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  category: string | null;
  fields: FormField[];
  is_active: boolean;
  is_public: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Derived
  submission_count?: number;
}


export type SubmissionStatus = "draft" | "submitted" | "approved" | "rejected" | "converted";

export interface FormSubmission {
  id: string;
  form_id: string;
  submitted_by: string;
  data: Record<string, any>;      // field_id → value
  status: SubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  converted_task_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  form?: IntakeForm;
  submitter?: { id: string; full_name: string; avatar_url: string | null; role: string };
  reviewer?: { id: string; full_name: string };
}


export const FIELD_TYPE_CONFIG: Record<FieldType, { label: string; icon: string; color: string }> = {
  text: { label: "Văn bản", icon: "Aa", color: "#3b82f6" },
  textarea: { label: "Đoạn văn", icon: "¶", color: "#3b82f6" },
  number: { label: "Số", icon: "#", color: "#6366f1" },
  date: { label: "Ngày", icon: "📅", color: "#f59e0b" },
  select: { label: "Chọn 1", icon: "▾", color: "#10b981" },
  multi_select: { label: "Chọn nhiều", icon: "☑", color: "#10b981" },
  checkbox: { label: "Checkbox", icon: "☐", color: "#8b5cf6" },
  radio: { label: "Radio", icon: "◉", color: "#8b5cf6" },
  file: { label: "File", icon: "📎", color: "#f97316" },
  user_picker: { label: "Người dùng", icon: "👤", color: "#ec4899" },
  project_picker: { label: "Dự án", icon: "🏗️", color: "#06b6d4" },
  priority_picker: { label: "Ưu tiên", icon: "⬆", color: "#ef4444" },
  section_header: { label: "Tiêu đề", icon: "-", color: "#94a3b8" },
};

export const SUBMISSION_STATUS_CONFIG: Record<SubmissionStatus, { label: string; color: string }> = {
  draft: { label: "Nháp", color: "#94a3b8" },
  submitted: { label: "Đã gửi", color: "#3b82f6" },
  approved: { label: "Đã duyệt", color: "#10b981" },
  rejected: { label: "Từ chối", color: "#ef4444" },
  converted: { label: "Đã tạo task", color: "#6366f1" },
};
