/**
 * Single parameter sweep configuration row.
 * Checkbox to enable + range (min/max/step) or list (comma values) input.
 */

import type { SweepRow, WizardAction } from "./batch-wizard-reducer";

interface Props {
  row: SweepRow;
  baseValue: string;
  dispatch: React.Dispatch<WizardAction>;
}

export function SweepParamRow({ row, baseValue, dispatch }: Props) {
  return (
    <div
      className={`p-3 rounded-xl border transition-all ${
        row.enabled
          ? "border-[#CCFF00]/30 bg-[#CCFF00]/[0.03]"
          : "border-[#1a1a1a] bg-transparent"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Checkbox */}
        <button
          onClick={() => dispatch({ type: "TOGGLE_SWEEP", key: row.key })}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-none
                      transition-all ${
            row.enabled ? "border-[#CCFF00] bg-[#CCFF00]/20" : "border-[#444]"
          }`}
        >
          {row.enabled && (
            <svg viewBox="0 0 12 12" className="w-3 h-3">
              <path d="M2 6l3 3 5-5" stroke="#CCFF00" strokeWidth="2"
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>

        {/* Label + base value */}
        <div className="flex-1 min-w-0">
          <span className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
            {row.label}
          </span>
          {!row.enabled && (
            <span className="text-white text-xs font-bold ml-2">
              BASE: {baseValue} {row.unit}
            </span>
          )}
        </div>

        {/* Mode toggle (only when enabled) */}
        {row.enabled && (
          <div className="flex gap-1 text-[10px]">
            <button
              onClick={() => dispatch({ type: "SET_SWEEP_MODE", key: row.key, mode: "range" })}
              className={`px-2 py-0.5 rounded cursor-none transition-all font-bold ${
                row.mode === "range"
                  ? "bg-[#CCFF00]/20 text-white"
                  : "text-[#555] hover:text-white"
              }`}
            >
              RANGE
            </button>
            <button
              onClick={() => dispatch({ type: "SET_SWEEP_MODE", key: row.key, mode: "list" })}
              className={`px-2 py-0.5 rounded cursor-none transition-all font-bold ${
                row.mode === "list"
                  ? "bg-[#CCFF00]/20 text-white"
                  : "text-[#555] hover:text-white"
              }`}
            >
              LIST
            </button>
          </div>
        )}
      </div>

      {/* Sweep inputs (only when enabled) */}
      {row.enabled && (
        <div className="mt-3 pl-8">
          {row.mode === "range" ? (
            <div className="flex items-center gap-2 text-sm">
              <input
                type="text"
                value={row.min}
                onChange={(e) =>
                  dispatch({ type: "SET_SWEEP_MIN", key: row.key, value: e.target.value })
                }
                placeholder="MIN"
                className="w-20 bg-transparent border-b border-[#333] text-white text-center
                           py-1 focus:border-[#CCFF00] focus:outline-none cursor-none"
              />
              <input
                type="text"
                value={row.max}
                onChange={(e) =>
                  dispatch({ type: "SET_SWEEP_MAX", key: row.key, value: e.target.value })
                }
                placeholder="MAX"
                className="w-20 bg-transparent border-b border-[#333] text-white text-center
                           py-1 focus:border-[#CCFF00] focus:outline-none cursor-none"
              />
              <input
                type="text"
                value={row.step}
                onChange={(e) =>
                  dispatch({ type: "SET_SWEEP_STEP", key: row.key, value: e.target.value })
                }
                placeholder="STEP"
                className="w-20 bg-transparent border-b border-[#333] text-white text-center
                           py-1 focus:border-[#CCFF00] focus:outline-none cursor-none"
              />
            </div>
          ) : (
            <input
              type="text"
              value={row.listValues}
              onChange={(e) =>
                dispatch({ type: "SET_SWEEP_LIST", key: row.key, values: e.target.value })
              }
              placeholder="e.g., 500, 750, 1000, 1250"
              className="w-full bg-transparent border-b border-[#333] text-white text-sm
                         py-1 focus:border-[#CCFF00] focus:outline-none cursor-none font-mono"
            />
          )}

        </div>
      )}
    </div>
  );
}
