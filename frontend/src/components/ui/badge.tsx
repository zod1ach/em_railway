import { cn } from "@/lib/utils";
import { type HTMLAttributes } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium transition-colors",
        variant === "default" && "bg-accent/10 text-accent",
        variant === "outline" && "border bg-transparent",
        className,
      )}
      {...props}
    />
  );
}
