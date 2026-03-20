import { cn } from "@/lib/cn";
import { InputHTMLAttributes, forwardRef } from "react";

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  unit?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ className, label, unit, id, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-[11px] text-muted font-display tracking-[0.15em]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={id}
          className={cn(
            "h-10 w-full border border-border bg-background px-3 text-sm text-foreground",
            "placeholder:text-muted/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20",
            "font-mono transition-colors",
            unit && "pr-12",
            className,
          )}
          {...props}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted font-mono">
            {unit}
          </span>
        )}
      </div>
    </div>
  ),
);
Input.displayName = "Input";
