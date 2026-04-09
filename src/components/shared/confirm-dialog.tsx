"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning";
  loading?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const iconColor = variant === "danger" ? "text-red-500" : "text-amber-500";
  const btnColor =
    variant === "danger"
      ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
      : "bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150" />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
            "w-[calc(100%-2rem)] max-w-md rounded-xl bg-card border border-border shadow-2xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "duration-150 focus:outline-none p-6",
          )}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div className={cn("w-12 h-12 rounded-full flex items-center justify-center bg-red-500/10", iconColor)}>
              <AlertTriangle size={24} />
            </div>

            <div className="space-y-2">
              <DialogPrimitive.Title className="text-base font-bold">
                {title}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="text-sm text-muted-foreground whitespace-pre-line">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>

            <div className="flex gap-3 w-full mt-2">
              <DialogPrimitive.Close
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border hover:bg-secondary transition-colors"
                disabled={loading}
              >
                {cancelLabel}
              </DialogPrimitive.Close>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={cn(
                  "flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  btnColor,
                )}
              >
                {loading ? "Đang xử lý..." : confirmLabel}
              </button>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
