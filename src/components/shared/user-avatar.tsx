"use client";

import { cn } from "@/lib/utils/cn";

export function UserAvatar({
  name,
  color,
  size = "sm",
  src,
}: {
  name: string;
  color?: string;
  size?: "xs" | "sm" | "md" | "lg";
  src?: string | null;
}) {
  const sizes = { xs: "w-6 h-6 text-[8px]", sm: "w-7 h-8 text-[10px]", md: "w-9 h-9 text-xs", lg: "w-11 h-11 text-sm" };
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(-2)
    .join("");

  if (src) {
    return <img src={src} alt={name} className={cn("rounded-full object-cover", sizes[size])} />;
  }

  return (
    <div
      className={cn("rounded-full flex items-center justify-center font-bold text-white flex-shrink-0", sizes[size])}
      style={{ background: color ?? "#6366f1" }}
      title={name}
    >
      {initials}
    </div>
  );
}
