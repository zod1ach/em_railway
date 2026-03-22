import React, { useState, useRef, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CaptureButtonProps {
  onCapture: () => Promise<void>;
  text?: string;
  workingText?: string;
  successText?: string;
  minDuration?: number;
  className?: string;
  disabled?: boolean;
}

export function CaptureButton({
  onCapture,
  text = "Capture",
  workingText = "Working on it...",
  successText = "Success",
  minDuration = 5000,
  className,
  disabled = false,
}: CaptureButtonProps) {
  const [state, setState] = useState<"idle" | "working" | "success">("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleClick = async () => {
    if (state !== "idle" || disabled) return;
    setState("working");

    const start = Date.now();
    try {
      await onCapture();
    } catch (err) {
      console.error("Capture failed:", err);
    }

    const elapsed = Date.now() - start;
    const remaining = Math.max(0, minDuration - elapsed);

    timerRef.current = setTimeout(() => {
      setState("success");
      timerRef.current = setTimeout(() => setState("idle"), 2000);
    }, remaining);
  };

  const label = state === "working" ? workingText : state === "success" ? successText : text;

  return (
    <button
      onClick={handleClick}
      disabled={disabled || state !== "idle"}
      className={cn(
        "group relative w-44 cursor-none overflow-hidden rounded-full border p-2 text-center text-xs font-semibold transition-all duration-300",
        state === "idle" && "border-[#333] bg-[#111] text-white hover:border-[#555]",
        state === "working" && "border-[#333] bg-[#111] text-[#888]",
        state === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
        disabled && "opacity-30 pointer-events-none",
        className,
      )}
    >
      {/* Idle state — hover animation */}
      {state === "idle" && (
        <>
          <span className="inline-block translate-x-1 transition-all duration-300 group-hover:translate-x-12 group-hover:opacity-0">
            {text}
          </span>
          <div className="absolute top-0 z-10 flex h-full w-full translate-x-12 items-center justify-center gap-2 text-black opacity-0 transition-all duration-300 group-hover:-translate-x-1 group-hover:opacity-100">
            <span>{text}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <div className="absolute left-[10%] top-[40%] h-2 w-2 scale-[1] rounded-lg bg-[#CCFF00] transition-all duration-300 group-hover:left-[0%] group-hover:top-[0%] group-hover:h-full group-hover:w-full group-hover:scale-[1.8]" />
        </>
      )}

      {/* Working state — spinner */}
      {state === "working" && (
        <span className="flex items-center justify-center gap-2">
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
            <path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          {workingText}
        </span>
      )}

      {/* Success state */}
      {state === "success" && (
        <span className="flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {successText}
        </span>
      )}
    </button>
  );
}
