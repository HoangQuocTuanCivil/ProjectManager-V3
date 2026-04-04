"use client";

import { useOrgSettings, useUpdateSetting } from "@/lib/hooks/use-data";
import { useAuthStore } from "@/lib/stores";
import { Section, Button } from "@/components/shared";

export default function OrganizationSettingsPage() {
  const { user } = useAuthStore();
  const { data: settings = [] } = useOrgSettings();
  const updateSetting = useUpdateSetting();

  const getSetting = (category: string, key: string) => {
    const s = settings.find((s: any) => s.category === category && s.key === key);
    return s?.value ?? "";
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Tổ chức</h2>
        <p className="text-base text-muted-foreground mt-0.5">Thông tin và cài đặt tổ chức</p>
      </div>

      <Section title="Thông tin cơ bản">
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-muted-foreground font-medium">Tên tổ chức</label>
              <input
                defaultValue={getSetting("general", "org_name") || "A2Z WorkHub"}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none"
                readOnly
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground font-medium">Domain</label>
              <input
                defaultValue={getSetting("general", "domain") || "workhub.a2z.com.vn"}
                className="mt-1 w-full h-9 px-3 rounded-lg border border-border bg-secondary text-base font-mono focus:border-primary focus:outline-none"
                readOnly
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm text-muted-foreground font-medium">Mô tả</label>
              <textarea
                defaultValue={getSetting("general", "description") || ""}
                rows={2}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none resize-none"
                readOnly
              />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Cài đặt chung">
        <div className="p-5 space-y-4">
          {[
            { label: "Ngôn ngữ mặc định", value: "Tiếng Việt" },
            { label: "Múi giờ", value: "UTC+7 (Hà Nội)" },
            { label: "Định dạng ngày", value: "DD/MM/YYYY" },
            { label: "Đơn vị tiền tệ", value: "VNĐ" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-base">{item.label}</span>
              <span className="text-base font-medium text-muted-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Giới hạn">
        <div className="p-5 space-y-3">
          {[
            { label: "Số dự án tối đa", value: "Không giới hạn" },
            { label: "Số thành viên tối đa", value: "Không giới hạn" },
            { label: "Dung lượng lưu trữ", value: "10 GB" },
            { label: "File upload tối đa", value: "10 MB / file" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/30">
              <span className="text-base">{item.label}</span>
              <span className="text-base font-mono text-primary">{item.value}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
