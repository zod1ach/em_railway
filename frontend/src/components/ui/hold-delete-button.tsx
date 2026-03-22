import * as React from "react";
import { Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface HoldDeleteButtonProps {
  onDelete: () => void;
  holdDuration?: number;
  disabled?: boolean;
  disabledMessage?: string;
  className?: string;
}

export function HoldDeleteButton({
  onDelete,
  holdDuration = 3000,
  disabled = false,
  disabledMessage,
  className,
}: HoldDeleteButtonProps) {
  const [state, setState] = React.useState<"idle" | "holding" | "deleting" | "deleted" | "denied">("idle");
  const [progress, setProgress] = React.useState(0);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = React.useRef(0);

  const cleanup = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressRef.current) clearInterval(progressRef.current);
  };

  React.useEffect(() => cleanup, []);

  const startHolding = () => {
    if (state !== "idle") return;

    if (disabled) {
      setState("denied");
      setTimeout(() => setState("idle"), 2500);
      return;
    }

    setState("holding");
    setProgress(0);
    startTimeRef.current = Date.now();

    progressRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / holdDuration) * 100, 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(progressRef.current!);
    }, 30);

    holdTimerRef.current = setTimeout(() => {
      setState("deleting");
      setProgress(100);
      onDelete();
      setTimeout(() => {
        setState("deleted");
        setTimeout(() => setState("idle"), 2000);
      }, 400);
    }, holdDuration);
  };

  const cancelHolding = () => {
    if (state !== "holding") return;
    cleanup();
    setProgress(0);
    setState("idle");
  };

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <button
        onMouseDown={startHolding}
        onMouseUp={cancelHolding}
        onMouseLeave={cancelHolding}
        onTouchStart={startHolding}
        onTouchEnd={cancelHolding}
        disabled={state === "deleting"}
        className={cn(
          "relative p-1 rounded transition-all duration-200 cursor-none select-none",
          state === "idle" && "text-[#555] hover:text-red-500",
          state === "holding" && "text-red-500 scale-95",
          state === "deleting" && "text-red-500 opacity-50",
          state === "deleted" && "text-emerald-500",
          state === "denied" && "text-[#555]",
        )}
        title={disabled ? disabledMessage : "Hold to delete"}
      >
        {/* Progress ring */}
        {state === "holding" && (
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 36 36"
          >
            <path
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              style={{ stroke: "#333", opacity: 0.3 }}
            />
            <path
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              style={{
                stroke: "#ef4444",
                strokeDasharray: `${progress}, 100`,
                transition: "stroke-dasharray 0.08s linear",
              }}
            />
          </svg>
        )}

        {state === "deleted" ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Denied message */}
      {state === "denied" && disabledMessage && (
        <span className="absolute left-full ml-2 whitespace-nowrap text-[10px] text-red-400 font-medium animate-in fade-in slide-in-from-left-1">
          {disabledMessage}
        </span>
      )}

      {/* Holding hint */}
      {state === "holding" && (
        <span className="absolute left-full ml-2 whitespace-nowrap text-[10px] text-red-400 font-medium animate-in fade-in">
          Hold...
        </span>
      )}
    </div>
  );
}
