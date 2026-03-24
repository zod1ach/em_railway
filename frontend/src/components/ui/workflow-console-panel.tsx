/**
 * Workflow console panel — shows stdout (OUTPUT) and stderr (ERROR) logs.
 * Auto-scrolls to bottom on new entries.
 */

import { useEffect, useRef, useState } from "react";
import type { LogEntry } from "@/lib/workflow-console";
import { formatTimestamp } from "@/lib/workflow-console";

interface Props {
  logs: readonly LogEntry[];
}

export function WorkflowConsolePanel({ logs }: Props) {
  const [tab, setTab] = useState<"output" | "error">("output");
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = logs.filter((l) => l.level === tab);
  const errorCount = logs.filter((l) => l.level === "error").length;

  // Auto-scroll on new entries
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [filtered.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Tab buttons */}
      <div className="flex shrink-0 items-center gap-0 border-b border-[#1a1a1a]">
        <button
          onClick={() => setTab("output")}
          className={`cursor-none px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors ${
            tab === "output"
              ? "border-b border-[#CCFF00] text-[#CCFF00]"
              : "text-[#555] hover:text-[#999]"
          }`}
        >
          Output
        </button>
        <button
          onClick={() => setTab("error")}
          className={`cursor-none flex items-center gap-1.5 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.2em] transition-colors ${
            tab === "error"
              ? "border-b border-red-400 text-red-400"
              : "text-[#555] hover:text-[#999]"
          }`}
        >
          Error
          {errorCount > 0 && (
            <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500/20 px-1 text-[8px] font-bold text-red-400">
              {errorCount}
            </span>
          )}
        </button>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-2 py-1 font-mono">
        {filtered.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-[#333]">
              {tab === "output" ? "No output yet" : "No errors"}
            </span>
          </div>
        )}
        {filtered.map((entry) => (
          <div key={entry.id} className="flex gap-2 py-px">
            <span className="shrink-0 text-[8px] text-[#444]">
              {formatTimestamp(entry.timestamp)}
            </span>
            <span
              className={`text-[9px] leading-tight ${
                entry.level === "error" ? "text-red-400" : "text-[#888]"
              }`}
            >
              {entry.message}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
