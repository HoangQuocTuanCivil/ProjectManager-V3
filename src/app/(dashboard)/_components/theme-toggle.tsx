"use client";

import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const label = theme === "dark" ? t.misc.switchToLight : t.misc.switchToDark;
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-8 h-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors text-base"
      title={label}
      aria-label={label}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
