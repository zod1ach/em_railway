/**
 * Modal showing the full cartesian product of swept parameters.
 * Overlays the canvas with blur backdrop.
 */

import { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

interface SweepParam {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number | null;
  values: number[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  sweepConfig: { parameters: SweepParam[] } | null;
  onLoadRun?: (runIndex: number, paramValues: Record<string, number>) => void;
}

/* ── Cartesian product of value arrays ── */
function cartesian(arrays: number[][]): number[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<number[][]>(
    (acc, arr) => acc.flatMap((combo) => arr.map((v) => [...combo, v])),
    [[]],
  );
}

function fmtVal(v: number): string {
  if (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0)) return v.toExponential(2).toUpperCase();
  return String(v);
}

export function WorkflowRunsTableModal({ open, onClose, sweepConfig, onLoadRun }: Props) {
  const params = sweepConfig?.parameters ?? [];

  const runs = useMemo(() => {
    if (params.length === 0) return [];
    const valueArrays = params.map((p) => p.values);
    return cartesian(valueArrays);
  }, [params]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-50 flex items-center justify-center"
          onClick={onClose}
        >
          {/* Blur backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Modal content */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 max-h-[70%] w-[80%] max-w-[600px] overflow-hidden rounded-lg border border-[#1a1a1a] bg-[#0a0a0a]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1a1a1a] px-4 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-white">
                ALL RUNS ({runs.length})
              </span>
              <button
                onClick={onClose}
                className="cursor-none text-[10px] font-bold uppercase tracking-[0.15em] text-[#555] hover:text-white transition-colors"
              >
                CLOSE
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto" style={{ maxHeight: "calc(70vh - 48px)" }}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#1a1a1a]">
                    <th className="sticky top-0 bg-[#0a0a0a] px-3 py-1.5 text-left text-[9px] font-bold uppercase tracking-[0.15em] text-[#555]">
                      RUN
                    </th>
                    {params.map((p) => (
                      <th
                        key={p.key}
                        className="sticky top-0 bg-[#0a0a0a] px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[#CCFF00]"
                      >
                        {p.label} {p.unit ? `(${p.unit})` : ""}
                      </th>
                    ))}
                    {onLoadRun && (
                      <th className="sticky top-0 bg-[#0a0a0a] px-3 py-1.5 text-right text-[9px] font-bold uppercase tracking-[0.15em] text-[#555]">
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {runs.map((combo, i) => (
                    <tr
                      key={i}
                      className="border-b border-[#111] hover:bg-[#111] transition-colors"
                    >
                      <td className="px-3 py-1 text-[9px] uppercase tracking-[0.1em] text-[#555]">
                        {i + 1}
                      </td>
                      {combo.map((val, j) => (
                        <td
                          key={j}
                          className="px-3 py-1 text-right text-[9px] uppercase tracking-[0.1em] text-white"
                        >
                          {fmtVal(val)}
                        </td>
                      ))}
                      {onLoadRun && (
                        <td className="px-3 py-1 text-right">
                          <button
                            onClick={() => {
                              const paramValues: Record<string, number> = {};
                              params.forEach((p, j) => { paramValues[p.key] = combo[j]; });
                              onLoadRun(i, paramValues);
                            }}
                            className="cursor-none text-[8px] font-bold uppercase tracking-[0.1em] text-[#555] hover:text-[#CCFF00] transition-colors"
                          >
                            LOAD
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
