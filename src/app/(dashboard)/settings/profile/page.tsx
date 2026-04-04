"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/stores";
import { useUpdateUser } from "@/lib/hooks/use-data";
import { createClient } from "@/lib/supabase/client";
import { ROLE_CONFIG } from "@/lib/utils/kpi";
import { Button } from "@/components/shared";
import { toast } from "sonner";
import { User, Camera, Mail, X } from "lucide-react";

const AVATAR_BUCKET = "avatars";
const MAX_SIZE_MB = 3;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

export default function ProfileSettingsPage() {
  const { user, setUser } = useAuthStore();
  const updateUser = useUpdateUser();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setJobTitle(user.job_title || "");
      setPhone(user.phone || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  if (!user) return <div className="p-8 text-center text-muted-foreground">Đang tải...</div>;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh (JPG, PNG, GIF, WebP)");
      return;
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      toast.error(`Ảnh quá lớn. Tối đa ${MAX_SIZE_MB}MB`);
      return;
    }

    setUploading(true);
    try {
      // Generate unique filename
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `${user.id}/${Date.now()}.${ext}`;

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split(`/storage/v1/object/public/${AVATAR_BUCKET}/`)[1];
        if (oldPath) {
          await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
        }
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(fileName);
      const newUrl = urlData.publicUrl;

      // Update user profile
      await updateUser.mutateAsync({ id: user.id, avatar_url: newUrl });
      setAvatarUrl(newUrl);
      setUser({ ...user, avatar_url: newUrl });
      toast.success("Đã cập nhật ảnh đại diện!");
    } catch (err: any) {
      toast.error(err.message || "Lỗi tải ảnh lên");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveAvatar = async () => {
    if (!avatarUrl) return;
    try {
      const oldPath = avatarUrl.split(`/storage/v1/object/public/${AVATAR_BUCKET}/`)[1];
      if (oldPath) {
        await supabase.storage.from(AVATAR_BUCKET).remove([oldPath]);
      }
      await updateUser.mutateAsync({ id: user.id, avatar_url: "" });
      setAvatarUrl("");
      setUser({ ...user, avatar_url: null as any });
      toast.success("Đã xóa ảnh đại diện");
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa ảnh");
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!fullName.trim()) return toast.error("Vui lòng nhập họ tên.");
      await updateUser.mutateAsync({
        id: user.id,
        full_name: fullName,
        job_title: jobTitle,
        phone,
      });
      toast.success("Đã cập nhật thông tin cá nhân!");
    } catch (err: any) {
      toast.error(err.message || "Lỗi cập nhật hồ sơ");
    }
  };

  const initialLetters = fullName
    ? fullName.split(" ").map((w) => w[0]).slice(-2).join("").toUpperCase()
    : "U";

  const inputClass = "w-full h-10 px-3 rounded-lg border border-border bg-card text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="max-w-4xl space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <User size={24} className="text-primary" />
          Hồ sơ cá nhân
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Cập nhật thông tin tài khoản của bạn.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6">
        {/* Left Column: Forms */}
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-xl p-5 md:p-6 shadow-sm">
            <h2 className="text-base font-semibold mb-4 leading-none">Thông tin cơ bản</h2>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Họ và tên <span className="text-destructive">*</span></label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e: any) => setFullName(e.target.value)}
                    placeholder="VD: Nguyễn Văn A"
                    required
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Chức danh</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e: any) => setJobTitle(e.target.value)}
                    placeholder="VD: Trưởng phòng"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Số điện thoại</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e: any) => setPhone(e.target.value)}
                    placeholder="VD: 0987654321"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <div className="relative">
                    <input type="text" value={user.email} disabled className={`${inputClass} bg-secondary/50 pl-9`} />
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Email không thể thay đổi tại đây.</p>
                </div>
              </div>

              {/* Avatar Upload */}
              <div className="space-y-2 pb-2">
                <label className="text-sm font-medium text-foreground">Ảnh đại diện</label>
                <div className="flex items-center gap-4">
                  {/* Preview */}
                  <div className="relative group">
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={fullName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-border"
                        onError={(e) => { (e.currentTarget as any).style.display = "none"; }}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold text-white border-2 border-border"
                        style={{ background: ROLE_CONFIG[user.role]?.color ?? "#6366f1" }}
                      >
                        {initialLetters}
                      </div>
                    )}
                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xóa ảnh"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Upload button */}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      className="hidden"
                      id="avatar-upload"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50"
                    >
                      <Camera size={16} />
                      {uploading ? "Đang tải lên..." : "Chọn ảnh"}
                    </button>
                    <p className="text-xs text-muted-foreground mt-1.5">JPG, PNG, GIF hoặc WebP. Tối đa {MAX_SIZE_MB}MB.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t border-border/50">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={updateUser.isPending}
                >
                  {updateUser.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Profile Summary Card */}
        <div>
          <div className="bg-card border border-border rounded-xl p-6 text-center shadow-sm sticky top-6">
            <div className="relative mx-auto w-24 h-24 mb-4">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full rounded-full object-cover border-4 border-background shadow-md"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <div
                  className="w-full h-full rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-md border-4 border-background"
                  style={{ background: ROLE_CONFIG[user.role]?.color ?? "#6366f1" }}
                >
                  {initialLetters}
                </div>
              )}
            </div>
            <h3 className="text-lg font-bold">{fullName}</h3>
            <p className="text-sm text-primary font-medium mt-1">{jobTitle || ROLE_CONFIG[user.role]?.label}</p>

            <div className="mt-6 pt-6 border-t border-border flex flex-col gap-3 text-sm text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vai trò:</span>
                <span className="font-semibold">{ROLE_CONFIG[user.role]?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium truncate max-w-[150px]" title={user.email}>{user.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trạng thái:</span>
                <span className="text-success font-medium">Hoạt động</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
