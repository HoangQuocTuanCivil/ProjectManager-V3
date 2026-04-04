"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Không thể gửi email đặt lại mật khẩu");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 shadow-lg animate-fade-in text-center">
        <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={28} className="text-green-600" />
        </div>
        <h2 className="text-lg font-bold mb-2">Đã gửi email</h2>
        <p className="text-sm text-muted-foreground mb-1">
          Link đặt lại mật khẩu đã được gửi đến
        </p>
        <p className="text-sm font-semibold text-primary mb-6">{email}</p>
        <p className="text-xs text-muted-foreground mb-6">
          Vui lòng kiểm tra hộp thư (bao gồm thư mục Spam). Link có hiệu lực trong 1 giờ.
        </p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          <ArrowLeft size={14} />
          Quay lại đăng nhập
        </a>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-8 shadow-lg animate-fade-in">
      <h2 className="text-lg font-bold text-center mb-1">Quên mật khẩu</h2>
      <p className="text-sm text-muted-foreground text-center mb-6">
        Nhập email của bạn, hệ thống sẽ gửi link đặt lại mật khẩu
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-muted-foreground font-medium">Email</label>
          <div className="relative mt-1">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-secondary text-base focus:border-primary focus:outline-none transition-colors"
            />
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !email}
          className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
        </button>
      </form>

      <div className="mt-6 text-center">
        <a
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} />
          Quay lại đăng nhập
        </a>
      </div>
    </div>
  );
}
