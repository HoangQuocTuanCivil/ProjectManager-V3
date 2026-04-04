"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";
import { SidebarContent } from "./sidebar";

export function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 transition-opacity md:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      {/* Drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-card border-r border-border flex flex-col transition-transform duration-200 md:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="absolute top-3 right-3 z-10">
          <button onClick={onClose} className="w-7 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground" aria-label="Đóng menu">
            <X size={18} />
          </button>
        </div>
        <SidebarContent collapsed={false} onToggle={() => {}} onNavClick={onClose} />
      </aside>
    </>
  );
}
