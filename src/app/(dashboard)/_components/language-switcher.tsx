"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils/cn";

function VNFlag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 2 / 3)} viewBox="0 0 30 20" className="rounded-[2px] shadow-sm border border-border/30">
      <rect width="30" height="20" fill="#DA251D" />
      <polygon points="15,4 16.8,9.5 22.5,9.5 17.8,12.8 19.5,18.2 15,15 10.5,18.2 12.2,12.8 7.5,9.5 13.2,9.5" fill="#FFFF00" />
    </svg>
  );
}

function UKFlag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 2 / 3)} viewBox="0 0 60 30" className="rounded-[2px] shadow-sm border border-border/30">
      <rect width="60" height="30" fill="#012169" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
      <path d="M0,0 L60,30 M60,0 L0,30" stroke="#C8102E" strokeWidth="2" />
      <path d="M30,0 V30 M0,15 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30,0 V30 M0,15 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="h-10 px-2 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
        title={locale === "vi" ? "Tiếng Việt" : "English"}
      >
        {locale === "vi" ? <VNFlag size={22} /> : <UKFlag size={22} />}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden min-w-[150px]">
            <button
              onClick={() => { setLocale("vi"); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors", locale === "vi" && "bg-primary/10 text-primary font-semibold")}
            >
              <VNFlag size={20} />
              <span>Tiếng Việt</span>
            </button>
            <button
              onClick={() => { setLocale("en"); setOpen(false); }}
              className={cn("w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-secondary transition-colors", locale === "en" && "bg-primary/10 text-primary font-semibold")}
            >
              <UKFlag size={20} />
              <span>English</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
