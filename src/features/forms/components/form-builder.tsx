"use client";

import { useState } from "react";
import { Button, Toggle } from "@/components/shared";
import { cn } from "@/lib/utils/cn";
import { FIELD_TYPE_CONFIG, type FormField, type FieldType, type FormFieldOption } from "../types/form.types";
import { SearchSelect } from "@/shared/ui/search-select";

interface FormBuilderProps {
  initialName?: string;
  initialDescription?: string;
  initialFields?: FormField[];
  onSave: (data: { name: string; description: string; fields: FormField[] }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function FormBuilder({ initialName = "", initialDescription = "", initialFields = [], onSave, onCancel, isSaving }: FormBuilderProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [fields, setFields] = useState<FormField[]>(initialFields);

  const addField = (type: FieldType) => {
    const cfg = FIELD_TYPE_CONFIG[type];
    const newField: FormField = {
      id: crypto.randomUUID(),
      label: cfg.label,
      field_type: type,
      is_required: false,
      sort_order: fields.length,
      options: ["select", "multi_select", "radio"].includes(type) ? [{ label: "Lựa chọn 1", value: "opt1" }] : undefined,
    };
    setFields([...fields, newField]);
  };

  const updateField = (id: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id: string) => {
    setFields(fields.filter((f) => f.id !== id));
  };

  const moveField = (id: string, dir: -1 | 1) => {
    const idx = fields.findIndex((f) => f.id === id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const copy = [...fields];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setFields(copy.map((f, i) => ({ ...f, sort_order: i })));
  };

  const addOption = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    const opts = [...(field.options || []), { label: `Lựa chọn ${(field.options?.length || 0) + 1}`, value: `opt${(field.options?.length || 0) + 1}` }];
    updateField(fieldId, { options: opts });
  };

  const updateOption = (fieldId: string, optIdx: number, updates: Partial<FormFieldOption>) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field?.options) return;
    const opts = field.options.map((o, i) => i === optIdx ? { ...o, ...updates } : o);
    updateField(fieldId, { options: opts });
  };

  const removeOption = (fieldId: string, optIdx: number) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field?.options || field.options.length <= 1) return;
    updateField(fieldId, { options: field.options.filter((_, i) => i !== optIdx) });
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-base font-bold">Thiết kế biểu mẫu</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Form Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="text-sm text-muted-foreground font-medium">Tên biểu mẫu *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Yêu cầu thiết kế mới"
              className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-medium focus:border-primary focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Mô tả mục đích biểu mẫu..."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none resize-none"
            />
          </div>
        </div>

        {/* Fields */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold">Các trường ({fields.length})</h3>
          </div>

          <div className="space-y-3">
            {fields.map((field, idx) => {
              const cfg = FIELD_TYPE_CONFIG[field.field_type];
              return (
                <div key={field.id} className="border border-border rounded-xl overflow-hidden">
                  <div className="h-[2px]" style={{ background: cfg.color }} />
                  <div className="p-3 space-y-2">
                    {/* Field header */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm w-5 text-center" style={{ color: cfg.color }}>{cfg.icon}</span>
                      <input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                        className="flex-1 bg-transparent text-base font-semibold focus:outline-none border-b border-transparent focus:border-primary"
                      />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span>Bắt buộc</span>
                          <Toggle checked={field.is_required} onChange={(v) => updateField(field.id, { is_required: v })} />
                        </div>
                        <button onClick={() => moveField(field.id, -1)} disabled={idx === 0} className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-20">▲</button>
                        <button onClick={() => moveField(field.id, 1)} disabled={idx === fields.length - 1} className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-20">▼</button>
                        <button onClick={() => removeField(field.id)} className="text-sm text-red-400 hover:text-red-300 ml-1">✕</button>
                      </div>
                    </div>

                    {/* Field config */}
                    <div className="flex items-center gap-3 pl-7 text-sm">
                      <SearchSelect
                        value={field.field_type}
                        onChange={(val) => updateField(field.id, { field_type: val as FieldType })}
                        options={Object.entries(FIELD_TYPE_CONFIG).map(([key, c]) => ({ value: key, label: `${c.icon} ${c.label}` }))}
                        placeholder="Chọn loại trường"
                        className="mt-1"
                      />
                      <input
                        value={field.placeholder || ""}
                        onChange={(e) => updateField(field.id, { placeholder: e.target.value })}
                        placeholder="Placeholder..."
                        className="flex-1 h-8 px-2 rounded border border-border bg-card text-sm focus:border-primary focus:outline-none"
                      />
                    </div>

                    {/* Options (for select/radio/multi_select) */}
                    {field.options && (
                      <div className="pl-7 space-y-1">
                        {field.options.map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <span className="text-[11px] text-muted-foreground w-4">
                              {field.field_type === "radio" ? "◉" : field.field_type === "checkbox" ? "☐" : "•"}
                            </span>
                            <input
                              value={opt.label}
                              onChange={(e) => updateOption(field.id, optIdx, { label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                              className="flex-1 h-6 px-2 rounded border border-border/50 bg-card text-xs focus:border-primary focus:outline-none"
                            />
                            <button
                              onClick={() => removeOption(field.id, optIdx)}
                              disabled={(field.options?.length || 0) <= 1}
                              className="text-[11px] text-muted-foreground hover:text-destructive disabled:opacity-20"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        <button onClick={() => addOption(field.id)} className="text-[11px] text-primary hover:underline pl-6">+ Thêm lựa chọn</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Field Buttons */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            <span className="text-sm text-muted-foreground py-1.5">+ Thêm trường:</span>
            {Object.entries(FIELD_TYPE_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => addField(key as FieldType)}
                className="px-2 py-1 rounded text-[11px] font-medium border border-border hover:border-primary/40 transition-all"
                style={{ color: cfg.color }}
              >
                {cfg.icon} {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/30">
        <p className="text-sm text-muted-foreground">{fields.length} trường · {fields.filter((f) => f.is_required).length} bắt buộc</p>
        <div className="flex gap-2">
          <Button onClick={onCancel}>Hủy</Button>
          <Button variant="primary" onClick={() => onSave({ name, description, fields })} disabled={isSaving || !name.trim()}>
            {isSaving ? "Đang lưu..." : "Lưu biểu mẫu"}
          </Button>
        </div>
      </div>
    </div>
  );
}
