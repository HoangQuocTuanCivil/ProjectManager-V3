import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { Providers } from "@/components/providers";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "A2Z WorkHub — Quản lý công việc & KPI",
  description: "Nền tảng quản lý dự án, công việc, KPI & chia khoán sản phẩm",
  icons: { icon: "/favicon.ico?v=2" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <I18nProvider>
            <Providers>
              {children}
            </Providers>
          </I18nProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              className: "!bg-card !text-foreground !border-border",
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
