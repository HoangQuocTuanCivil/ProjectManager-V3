"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="text-center max-w-md px-4">
        <p className="text-4xl mb-4">⚠️</p>
        <h2 className="text-lg font-bold mb-2">Đã xảy ra lỗi</h2>
        <p className="text-base text-muted-foreground mb-6">
          {error.message || "Có lỗi không mong muốn. Vui lòng thử lại."}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all"
          >
            Thử lại
          </button>
          <a
            href="/"
            className="px-5 py-2 rounded-lg border border-border text-base font-medium hover:bg-secondary transition-colors"
          >
            Về trang chủ
          </a>
        </div>
      </div>
    </div>
  );
}
