"use client";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center max-w-md px-4">
        <p className="text-5xl mb-4">⚠️</p>
        <h2 className="text-lg font-bold mb-2">Đã xảy ra lỗi</h2>
        <p className="text-base text-muted-foreground mb-6">
          {error.message || "Có lỗi không mong muốn xảy ra. Vui lòng thử lại."}
        </p>
        <button
          onClick={reset}
          className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all"
        >
          Thử lại
        </button>
      </div>
    </div>
  );
}
