/**
 * Batch Explorer filter panel.
 * One dual-range slider per swept param, live count, progressive narrowing pills.
 */

import { motion, AnimatePresence } from "motion/react";
import { Zap, X } from "lucide-react";
import { DualRangeSlider } from "./dual-range-slider";
import type { SweepParameter } from "@/types/project-files";
import type { RangeFilter } from "@/hooks/use-batch-filter";

interface BatchFilterPanelProps {
  sweepAxes: SweepParameter[];
  filters: RangeFilter[];
  distinctRemaining: Record<string, number[]>;
  totalRuns: number;
  filteredCount: number;
  onSetFilter: (key: string, min?: number, max?: number) => void;
  onClearFilter: (key: string) => void;
  onClearAll: () => void;
  onExactFilter: (key: string, value: number) => void;
}

export function BatchFilterPanel({
  sweepAxes,
  filters,
  distinctRemaining,
  totalRuns,
  filteredCount,
  onSetFilter,
  onClearFilter,
  onClearAll,
  onExactFilter,
}: BatchFilterPanelProps) {
  const hasActiveFilters = filters.length > 0;

  const getFilter = (key: string): RangeFilter | undefined =>
    filters.find((f) => f.key === key);

  return (
    <div className="bg-[#111]/50 border border-[#222] rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-[#888] text-[11px] font-bold uppercase tracking-wider">
          Filters
        </h3>
        <div className="flex items-center gap-3">
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-[#555] hover:text-[#CCFF00] text-[11px] transition-colors cursor-none flex items-center gap-1"
            >
              <X size={11} />
              Clear all
            </button>
          )}
          <span className="text-[#888] text-sm">
            Showing{" "}
            <span className={filteredCount < totalRuns ? "text-[#CCFF00] font-bold" : "text-white"}>
              {filteredCount}
            </span>{" "}
            of {totalRuns} runs
          </span>
        </div>
      </div>

      {/* One slider per swept param */}
      <div className="space-y-5">
        {sweepAxes.map((axis) => {
          const filter = getFilter(axis.key);
          const remaining = distinctRemaining[axis.key];
          const isFiltered = !!filter;

          return (
            <div key={axis.key} className="space-y-2">
              <DualRangeSlider
                min={axis.min}
                max={axis.max}
                step={axis.step ?? 0.001}
                values={axis.values ?? []}
                low={filter?.min}
                high={filter?.max}
                unit={axis.unit}
                label={axis.label}
                onChange={(low, high) => {
                  if (low === undefined && high === undefined) {
                    onClearFilter(axis.key);
                  } else {
                    onSetFilter(axis.key, low, high);
                  }
                }}
              />

              {/* Progressive narrowing: distinct remaining pills */}
              <AnimatePresence>
                {!isFiltered && remaining && remaining.length > 0 && hasActiveFilters && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Zap size={11} className="text-[#CCFF00] shrink-0" />
                      <span className="text-[#555] text-[10px]">
                        {remaining.length} values:
                      </span>
                      {remaining.slice(0, 12).map((val) => (
                        <button
                          key={val}
                          onClick={() => onExactFilter(axis.key, val)}
                          className="bg-[#1c1c1c] text-white text-[10px] rounded-full px-2 py-0.5
                                     hover:bg-[#CCFF00]/20 hover:text-[#CCFF00] transition-colors cursor-none"
                        >
                          {val}
                        </button>
                      ))}
                      {remaining.length > 12 && (
                        <span className="text-[#555] text-[10px]">
                          +{remaining.length - 12} more
                        </span>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
