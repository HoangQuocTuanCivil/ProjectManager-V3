import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-screen bg-background">
      <div className="text-center max-w-md px-4">
        <p className="text-6xl font-bold font-mono text-primary mb-2">404</p>
        <h2 className="text-lg font-bold mb-2">Không tìm thấy trang</h2>
        <p className="text-base text-muted-foreground mb-6">
          Trang bạn tìm kiếm không tồn tại hoặc đã bị xóa.
        </p>
        <Link
          href="/"
          className="inline-flex px-6 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-base hover:brightness-110 transition-all"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
