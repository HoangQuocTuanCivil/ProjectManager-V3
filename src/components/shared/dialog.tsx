"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Dialog({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {children}
    </DialogPrimitive.Root>
  );
}

export function DialogContent({
  children,
  title,
  description,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}) {
  const sizes = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 duration-150" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
          "w-[calc(100%-2rem)] rounded-xl bg-card border border-border shadow-2xl",
          "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          "duration-150 focus:outline-none",
          sizes[size],
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <DialogPrimitive.Title className="text-base font-bold">
              {title}
            </DialogPrimitive.Title>
            {description && (
              <DialogPrimitive.Description className="text-sm text-muted-foreground mt-0.5">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="w-7 h-8 rounded-md flex items-center justify-center hover:bg-secondary transition-colors text-muted-foreground">
            <X size={18} />
          </DialogPrimitive.Close>
        </div>

        {/* Body */}
        <div className="p-5">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTrigger({ children }: { children: React.ReactNode }) {
  return <DialogPrimitive.Trigger asChild>{children}</DialogPrimitive.Trigger>;
}
