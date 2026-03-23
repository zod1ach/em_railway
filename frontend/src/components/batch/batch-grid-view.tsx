/**
 * 2D heatmap grid for batch runs when exactly 2 unpinned params remain.
 * Axes = the 2 unfixed params, cell value = peak B-field or run number.
 */

import { useMemo } from "react";
import { motion } from "motion/react";
import type { BatchRun, SweepParameter } from "@/types/project-files";

interface BatchGridViewProps {
  runs: BatchRun[];
  sweepAxes: SweepParameter[];
  unpinnedKeys: string[];
  onOpenRun: (run: BatchRun) => void;
  selectedIds: Set<string>;
  onToggleSelect: (fileId: string) => void;
}

/** Interpolate between two colors based on t (0-1). */
function lerpColor(t: number): string {
  // Dark blue → teal → #CCFF00
  const r = Math.round(10 + t * (204 - 10));
  const g = Math.round(20 + t * (255 - 20));
  const b = Math.round(80 + t * (0 - 80));
  return `rgb(${r},${g},${b})`;
}

export function BatchGridView({
  runs,
  sweepAxes,
  unpinnedKeys,
  onOpenRun,
  selectedIds,
  onToggleSelect,
}: BatchGridViewProps) {
  // Hooks must be called unconditionally (Rules of Hooks)
  const [xKey, yKey] = unpinnedKeys.length === 2 ? unpinnedKeys : ["", ""];
  const xAxis = sweepAxes.find((a) => a.key === xKey);
  const yAxis = sweepAxes.find((a) => a.key === yKey);

  const { xValues, yValues, grid, minVal, maxVal } = useMemo(() => {
    if (unpinnedKeys.length !== 2) {
      return { xValues: [] as number[], yValues: [] as number[], grid: [] as (BatchRun | null)[][], minVal: Infinity, maxVal: -Infinity };
    }

    const xSet = new Set<number>();
    const ySet = new Set<number>();

    for (const run of runs) {
      if (run.params[xKey] !== undefined) xSet.add(run.params[xKey]);
      if (run.params[yKey] !== undefined) ySet.add(run.params[yKey]);
    }

    const xVals = Array.from(xSet).sort((a, b) => a - b);
    const yVals = Array.from(ySet).sort((a, b) => a - b);

    const g: (BatchRun | null)[][] = yVals.map(() => xVals.map(() => null));
    let minV = Infinity;
    let maxV = -Infinity;

    for (const run of runs) {
      const xi = xVals.indexOf(run.params[xKey]);
      const yi = yVals.indexOf(run.params[yKey]);
      if (xi >= 0 && yi >= 0) {
        g[yi][xi] = run;
        const bField = run.calc_peak_b_field;
        if (bField != null) {
          if (bField < minV) minV = bField;
          if (bField > maxV) maxV = bField;
        }
      }
    }

    return { xValues: xVals, yValues: yVals, grid: g, minVal: minV, maxVal: maxV };
  }, [runs, xKey, yKey]);

  const range = maxVal - minVal || 1;

  // Guard AFTER hooks
  if (unpinnedKeys.length !== 2) {
    return (
      <div className="flex items-center justify-center py-12 text-[#555] text-sm">
        Pin all but 2 parameters to enable grid view
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* X-axis label */}
      <div className="text-center text-[#888] text-[11px] font-bold uppercase tracking-wider">
        {xAxis?.label ?? xKey} ({xAxis?.unit ?? ""})
      </div>

      <div className="flex">
        {/* Y-axis label (rotated) */}
        <div className="flex items-center justify-center w-8">
          <span
            className="text-[#888] text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            {yAxis?.label ?? yKey} ({yAxis?.unit ?? ""})
          </span>
        </div>

        {/* Grid table */}
        <div className="overflow-x-auto flex-1">
          <table className="border-collapse">
            {/* X-axis header */}
            <thead>
              <tr>
                <th className="w-16" />
                {xValues.map((xv) => (
                  <th
                    key={xv}
                    className="text-[#888] text-[10px] font-mono px-1 py-1 text-center min-w-[60px]"
                  >
                    {xv}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {yValues.map((yv, yi) => (
                <tr key={yv}>
                  {/* Y-axis value */}
                  <td className="text-[#888] text-[10px] font-mono pr-2 py-1 text-right">
                    {yv}
                  </td>
                  {/* Cells */}
                  {xValues.map((xv, xi) => {
                    const run = grid[yi][xi];
                    const bField = run?.calc_peak_b_field;
                    const t = bField != null ? (bField - minVal) / range : 0.5;
                    const bg = bField != null ? lerpColor(t) : "#1a1a1a";
                    const isSelected = run ? selectedIds.has(run.file_id) : false;

                    return (
                      <td key={`${xv}-${yv}`} className="p-0.5">
                        <motion.button
                          onClick={() => {
                            if (run) onOpenRun(run);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            if (run) onToggleSelect(run.file_id);
                          }}
                          className={`w-full min-w-[56px] h-10 rounded text-[10px] font-mono cursor-none
                                      transition-all border ${
                                        isSelected
                                          ? "border-[#CCFF00] ring-1 ring-[#CCFF00]"
                                          : "border-transparent hover:border-[#444]"
                                      }`}
                          style={{ backgroundColor: bg }}
                          whileHover={{ scale: 1.05 }}
                          transition={{ duration: 0.1 }}
                          title={
                            run
                              ? `Run #${run.run_number}\n${xKey}=${xv}, ${yKey}=${yv}\nB=${bField?.toExponential(2) ?? "—"}`
                              : "No data"
                          }
                        >
                          {bField != null ? bField.toExponential(1) : run ? `#${run.run_number}` : ""}
                        </motion.button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      {minVal !== Infinity && (
        <div className="flex items-center gap-2 justify-center">
          <span className="text-[#555] text-[10px]">{minVal.toExponential(1)}</span>
          <div
            className="h-2 w-32 rounded-full"
            style={{
              background: `linear-gradient(to right, ${lerpColor(0)}, ${lerpColor(0.5)}, ${lerpColor(1)})`,
            }}
          />
          <span className="text-[#555] text-[10px]">{maxVal.toExponential(1)}</span>
          <span className="text-[#555] text-[10px] ml-1">Peak B (T)</span>
        </div>
      )}
    </div>
  );
}
