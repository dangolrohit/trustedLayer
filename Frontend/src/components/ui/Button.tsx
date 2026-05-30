import type { ButtonHTMLAttributes } from "react";

import { cn } from "../../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
}

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variant === "primary" && "bg-primary text-primary-foreground hover:bg-sky-700",
        variant === "secondary" && "border border-border bg-white text-foreground hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "bg-rose-600 text-white hover:bg-rose-700",
        size === "sm" && "h-9 px-3 text-sm",
        size === "md" && "h-11 px-4 text-sm",
        size === "icon" && "h-10 w-10",
        className,
      )}
      {...props}
    />
  );
}
