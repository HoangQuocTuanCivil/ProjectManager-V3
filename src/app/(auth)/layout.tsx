"use client";

import { useTheme } from "next-themes";
import { ParticleNetwork } from "@/components/shared/particle-network";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      {/* Animated particle network background */}
      <ParticleNetwork />

      {/* Radial gradient overlay for depth */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,hsl(var(--primary)/0.08),transparent_60%)]" />

      {/* Theme toggle */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 w-9 h-9 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-secondary transition-colors z-10"
      >
        {theme === "dark" ? "☀️" : "🌙"}
      </button>

      <div className="relative z-10 w-full max-w-md px-4">
        {/* Brand */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="A2Z Logo"
            className="mx-auto mb-3 w-28 h-28 object-contain"
          />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            A2Z WorkHub
          </h1>
          <p className="text-sm text-muted-foreground tracking-[2px] uppercase mt-1">
            Quản lý công việc & KPI
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}
