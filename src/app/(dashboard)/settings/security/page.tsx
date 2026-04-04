"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/stores";
import { Section, Button, Toggle } from "@/components/shared";
import { formatDate } from "@/lib/utils/kpi";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SecuritySettingsPage() {
  const { user } = useAuthStore();
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Đổi mật khẩu thành công!");
        setShowPasswordForm(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">Bảo mật</h2>
        <p className="text-base text-muted-foreground mt-0.5">Quản lý bảo mật tài khoản và phiên làm việc</p>
      </div>

      {/* Password */}
      <Section title="Mật khẩu">
        {!showPasswordForm ? (
          <div className="p-5 flex items-center justify-between">
            <div>
              <p className="text-base font-medium">Đổi mật khẩu</p>
              <p className="text-xs text-muted-foreground">Khuyến nghị đổi mật khẩu định kỳ 90 ngày</p>
            </div>
            <Button size="sm" onClick={() => setShowPasswordForm(true)}>Đổi mật khẩu</Button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Mật khẩu mới</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                className="mt-1 w-full px-3 py-2 text-base rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                className="mt-1 w-full px-3 py-2 text-base rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleChangePassword} disabled={loading}>
                {loading ? "Đang xử lý..." : "Lưu mật khẩu"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowPasswordForm(false); setNewPassword(""); setConfirmPassword(""); }}>
                Hủy
              </Button>
            </div>
          </div>
        )}
      </Section>

      {/* 2FA */}
      <Section title="Xác thực 2 bước (2FA)">
        <div className="p-5 flex items-center justify-between">
          <div>
            <p className="text-base font-medium">Xác thực 2 bước</p>
            <p className="text-xs text-muted-foreground">Thêm lớp bảo mật với OTP qua Authenticator App</p>
          </div>
          <Toggle checked={false} onChange={() => {}} />
        </div>
      </Section>

      {/* Sessions */}
      <Section title="Phiên hoạt động">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-10 rounded-lg bg-green-500/10 flex items-center justify-center text-green-500 text-base">💻</div>
              <div>
                <p className="text-base font-medium">Phiên hiện tại</p>
                <p className="text-[11px] text-muted-foreground">
                  {user?.email} · Đăng nhập: {user?.last_login ? formatDate(user.last_login) : "—"}
                </p>
              </div>
            </div>
            <span className="text-[11px] text-green-500 font-semibold bg-green-500/10 px-2 py-0.5 rounded">Đang hoạt động</span>
          </div>
        </div>
      </Section>

      {/* API Keys */}
      <Section title="API Keys">
        <div className="p-5">
          <p className="text-base text-muted-foreground mb-3">Quản lý API keys cho tích hợp bên thứ 3</p>
          <Button size="sm" disabled>+ Tạo API Key</Button>
        </div>
      </Section>

      {/* Audit Log */}
      <Section title="Lịch sử hoạt động">
        <div className="p-5">
          <p className="text-base text-muted-foreground">
            Xem nhật ký hoạt động tại{" "}
            <span className="text-primary font-medium">Báo cáo → Audit Log</span>
          </p>
        </div>
      </Section>

      {/* Danger Zone */}
      <Section title="Vùng nguy hiểm">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between p-3 border border-destructive/30 rounded-xl">
            <div>
              <p className="text-base font-medium text-destructive">Xóa tài khoản</p>
              <p className="text-xs text-muted-foreground">Thao tác này không thể hoàn tác. Tất cả dữ liệu sẽ bị xóa.</p>
            </div>
            <Button size="sm" variant="destructive" disabled>Xóa tài khoản</Button>
          </div>
        </div>
      </Section>
    </div>
  );
}
