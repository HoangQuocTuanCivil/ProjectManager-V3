"use client";

import { useState } from "react";
import { Button } from "@/components/shared";
import { SearchSelect } from "@/components/shared/search-select";
import { FIELD_TYPE_CONFIG, type FormField, type IntakeForm } from "../types/form.types";

interface FormRendererProps {
  form: IntakeForm;
  onSubmit: (data: Record<string, any>) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function FormRenderer({ form, onSubmit, onCancel, isSubmitting }: FormRendererProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (fieldId: string, value: any) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) setErrors((prev) => { const copy = { ...prev }; delete copy[fieldId]; return copy; });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    form.fields.forEach((field) => {
      if (field.is_required) {
        const val = values[field.id];
        if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) {
          newErrors[field.id] = "Trường bắt buộc";
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    onSubmit(values);
  };

  const sortedFields = [...form.fields].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-bold">{form.name}</h2>
        {form.description && <p className="text-sm text-muted-foreground mt-0.5">{form.description}</p>}
      </div>

      <div className="p-6 space-y-5">
        {sortedFields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.id]}
            onChange={(val) => setValue(field.id, val)}
            error={errors[field.id]}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex justify-end gap-2 bg-secondary/30">
        <Button onClick={onCancel}>Hủy</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Đang gửi..." : "Gửi biểu mẫu"}
        </Button>
      </div>
    </div>
  );
}


function FieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: any;
  onChange: (val: any) => void;
  error?: string;
}) {
  const cfg = FIELD_TYPE_CONFIG[field.field_type];

  if (field.field_type === "section_header") {
    return (
      <div className="pt-3 pb-1 border-b border-border">
        <h3 className="text-base font-bold">{field.label}</h3>
        {field.description && <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>}
      </div>
    );
  }

  const inputClass = "w-full px-3 rounded-lg border bg-secondary text-base focus:border-primary focus:outline-none transition-colors";
  const errorClass = error ? "border-destructive" : "border-border";

  return (
    <div>
      <label className="text-sm text-muted-foreground font-medium flex items-center gap-1">
        <span style={{ color: cfg.color }}>{cfg.icon}</span>
        {field.label}
        {field.is_required && <span className="text-destructive">*</span>}
      </label>
      {field.description && <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">{field.description}</p>}

      {field.field_type === "text" && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`mt-1 h-9 ${inputClass} ${errorClass}`}
        />
      )}

      {field.field_type === "textarea" && (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={3}
          className={`mt-1 py-2 ${inputClass} ${errorClass} resize-none`}
        />
      )}

      {field.field_type === "number" && (
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value ? +e.target.value : "")}
          placeholder={field.placeholder}
          className={`mt-1 h-9 font-mono ${inputClass} ${errorClass}`}
        />
      )}

      {field.field_type === "date" && (
        <input
          type="date"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className={`mt-1 h-9 ${inputClass} ${errorClass}`}
        />
      )}

      {field.field_type === "select" && (
        <SearchSelect
          value={value || ""}
          onChange={(val) => onChange(val)}
          options={field.options?.map((opt) => ({ value: opt.value, label: opt.label })) || []}
          placeholder={field.placeholder || "Chọn..."}
          className="mt-1"
        />
      )}

      {field.field_type === "multi_select" && (
        <div className="mt-1 space-y-1">
          {field.options?.map((opt) => {
            const selected = Array.isArray(value) ? value.includes(opt.value) : false;
            return (
              <label key={opt.value} className="flex items-center gap-2 py-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => {
                    const arr = Array.isArray(value) ? [...value] : [];
                    if (e.target.checked) arr.push(opt.value);
                    else arr.splice(arr.indexOf(opt.value), 1);
                    onChange(arr);
                  }}
                  className="accent-primary"
                />
                <span className="text-base">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {field.field_type === "radio" && (
        <div className="mt-1 space-y-1">
          {field.options?.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 py-1 cursor-pointer">
              <input
                type="radio"
                name={field.id}
                checked={value === opt.value}
                onChange={() => onChange(opt.value)}
                className="accent-primary"
              />
              <span className="text-base">{opt.label}</span>
            </label>
          ))}
        </div>
      )}

      {field.field_type === "checkbox" && (
        <label className="flex items-center gap-2 mt-1 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-base">{field.placeholder || field.label}</span>
        </label>
      )}

      {field.field_type === "priority_picker" && (
        <SearchSelect
          value={value || ""}
          onChange={(val) => onChange(val)}
          options={[
            { value: "low", label: "Thấp" },
            { value: "medium", label: "Trung bình" },
            { value: "high", label: "Cao" },
            { value: "urgent", label: "Khẩn cấp" },
          ]}
          placeholder="Chọn ưu tiên..."
          className="mt-1"
        />
      )}

      {(field.field_type === "file" || field.field_type === "user_picker" || field.field_type === "project_picker") && (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `Chọn ${cfg.label.toLowerCase()}...`}
          className={`mt-1 h-9 ${inputClass} ${errorClass}`}
        />
      )}

      {error && <p className="text-[11px] text-destructive mt-1">{error}</p>}
    </div>
  );
}
