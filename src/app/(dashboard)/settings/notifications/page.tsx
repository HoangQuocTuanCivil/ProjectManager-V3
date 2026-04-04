"use client";

import { useState } from "react";
import { Section, Toggle } from "@/components/shared";

interface NotifSetting {
  key: string;
  label: string;
  description: string;
  email: boolean;
  push: boolean;
}

const DEFAULT_SETTINGS: NotifSetting[] = [
  { key: "task_assigned", label: "Giao việc mới", description: "Khi bạn được giao công việc mới", email: true, push: true },
  { key: "task_completed", label: "Task hoàn thành", description: "Khi task bạn quản lý được hoàn thành", email: true, push: true },
  { key: "task_overdue", label: "Task quá hạn", description: "Khi task vượt quá deadline", email: true, push: true },
  { key: "kpi_evaluated", label: "Nghiệm thu KPI", description: "Khi task được nghiệm thu và chấm KPI", email: true, push: true },
  { key: "allocation_approved", label: "Duyệt khoán", description: "Khi khoán được phê duyệt", email: true, push: false },
  { key: "workflow_pending", label: "Chờ phê duyệt", description: "Khi có workflow cần bạn xử lý", email: true, push: true },
  { key: "comment_mention", label: "Nhắc đến bạn", description: "Khi có ai nhắc đến bạn trong bình luận", email: false, push: true },
  { key: "project_update", label: "Cập nhật dự án", description: "Khi dự án bạn tham gia có thay đổi", email: false, push: false },
];

export default function NotificationsSettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const toggle = (key: string, channel: "email" | "push") => {
    setSettings(settings.map((s) =>
      s.key === key ? { ...s, [channel]: !s[channel] } : s
    ));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Cài đặt thông báo</h2>
        <p className="text-base text-muted-foreground mt-0.5">Tùy chỉnh cách bạn nhận thông báo</p>
      </div>

      <Section title="Kênh thông báo">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sự kiện</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Email</th>
                <th className="text-center px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-24">Push</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.key} className="border-b border-border/40">
                  <td className="px-4 py-3">
                    <p className="text-base font-medium">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle checked={s.email} onChange={() => toggle(s.key, "email")} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex justify-center">
                      <Toggle checked={s.push} onChange={() => toggle(s.key, "push")} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Tần suất">
        <div className="p-5 space-y-3">
          {[
            { label: "Email digest", value: "Hàng ngày (8:00 AM)" },
            { label: "Push notifications", value: "Ngay lập tức" },
            { label: "Chế độ im lặng", value: "22:00 - 07:00" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-base">{item.label}</span>
              <span className="text-base font-medium text-muted-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
