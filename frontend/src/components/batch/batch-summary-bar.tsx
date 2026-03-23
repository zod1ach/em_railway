/**
 * Summary bar showing swept param cards.
 */

import type { SweepParameter } from "@/types/project-files";

interface BatchSummaryBarProps {
  sweepAxes: SweepParameter[];
}

export function BatchSummaryBar({ sweepAxes }: BatchSummaryBarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {sweepAxes.map((axis) => (
        <div
          key={axis.key}
          className="bg-[#111] border border-[#222] rounded-xl px-4 py-3 min-w-[140px]"
        >
          <div className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
            {axis.label}
          </div>
          <div className="text-white text-sm mt-1">
            {axis.min} — {axis.max}{" "}
            <span className="text-[#888] font-bold">{axis.unit}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
