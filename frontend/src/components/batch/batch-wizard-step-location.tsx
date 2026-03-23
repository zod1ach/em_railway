/**
 * Wizard Step 3 (Location Mode): Map waypoints + date sweep config.
 * Reuses WMMMap in "line" mode for drawing waypoints on the map.
 */

import { useRef } from "react";
import { WMMMap, type LinePoint, type WMMMapHandle } from "@/components/ui/wmm-map";
import { CaptureButton } from "@/components/ui/capture-button";
import { estimateSizeBytes, formatBytes } from "@/lib/sweep-utils";
import { BATCH_CAP, AVG_FILE_SIZES } from "@/lib/shared-param-defs";
import type { WizardState, WizardAction } from "./batch-wizard-reducer";
import { countDates } from "./batch-wizard-reducer";

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
}

export function BatchWizardStepLocation({ state, dispatch }: Props) {
  const mapRef = useRef<WMMMapHandle>(null);
  const loc = state.location;

  const numDates = countDates(loc);
  const total = state.totalCombinations;
  const estSize = estimateSizeBytes(total, AVG_FILE_SIZES.dc_location ?? 12_000);

  const capStatus =
    total > BATCH_CAP.MAX
      ? "blocked"
      : total > BATCH_CAP.AMBER
        ? "red"
        : total > BATCH_CAP.GREEN
          ? "amber"
          : "green";

  const canAdvance = total > 0 && total <= BATCH_CAP.MAX;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white text-lg font-semibold mb-1">Location Sweep</h3>
        <p className="text-[#888] text-sm">
          Draw a line on the map and configure date range
        </p>
      </div>

      {/* Map */}
      <div>
        <WMMMap
          ref={mapRef}
          mode="line"
          disabled={false}
          onLineChange={(pts: LinePoint[]) => {
            dispatch({
              type: "SET_WAYPOINTS",
              waypoints: pts.map((p) => ({ lat: p.lat, lng: p.lng })),
            });
          }}
          onClear={() => {
            dispatch({ type: "SET_WAYPOINTS", waypoints: [] });
          }}
          className="w-full h-[280px] border border-[#222] rounded-lg"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[#555] text-xs">
            {loc.waypoints.length} waypoint{loc.waypoints.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Interpolation points */}
      <div>
        <span className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
          Interpolation Points
        </span>
        <div className="flex items-center gap-3 mt-1">
          <input
            type="number"
            value={loc.numPoints}
            onChange={(e) => dispatch({ type: "SET_NUM_POINTS", numPoints: parseInt(e.target.value) || 1 })}
            min={1}
            max={500}
            className="w-24 bg-transparent border-b-[2px] border-white/70 text-white text-sm py-1
                       focus:border-[#CCFF00] outline-none cursor-none"
          />
          <span className="text-[#555] text-xs">(MAX ALLOWED 500)</span>
        </div>
      </div>

      {/* Separator */}
      <div className="relative my-4">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-[#0d0d0d] px-3 text-[9px] text-[#444] uppercase tracking-widest">
          Date
        </span>
      </div>

      {/* Date sweep mode */}
      <div className="space-y-3">
        <div className="flex gap-2">
          {(["single", "daily", "monthly"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => dispatch({ type: "SET_DATE_SWEEP_MODE", mode })}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-none transition-all ${
                loc.dateSweepMode === mode
                  ? "bg-[#CCFF00]/20 text-white"
                  : "text-[#555] hover:text-white"
              }`}
            >
              {mode.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Date inputs */}
        <div className="flex items-center gap-4">
          <div>
            <span className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
              {loc.dateSweepMode === "single" ? "Date" : "Start Date"}
            </span>
            <input
              type="text"
              value={loc.startDate}
              onChange={(e) => dispatch({ type: "SET_START_DATE", date: e.target.value })}
              placeholder="DD/MM/YYYY"
              className="w-full bg-transparent border-b-[2px] border-white/70 text-white text-sm py-1 mt-1
                         focus:border-[#CCFF00] outline-none cursor-none placeholder:text-[#333]"
            />
          </div>

          {loc.dateSweepMode === "daily" && (
            <div>
              <span className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
                End Date
              </span>
              <input
                type="text"
                value={loc.endDate}
                onChange={(e) => dispatch({ type: "SET_END_DATE", date: e.target.value })}
                placeholder="DD/MM/YYYY"
                className="w-full bg-transparent border-b-[2px] border-white/70 text-white text-sm py-1 mt-1
                           focus:border-[#CCFF00] outline-none cursor-none placeholder:text-[#333]"
              />
            </div>
          )}

          {loc.dateSweepMode === "monthly" && (
            <div>
              <span className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
                Months
              </span>
              <input
                type="number"
                value={loc.numMonths}
                onChange={(e) => dispatch({ type: "SET_NUM_MONTHS", months: parseInt(e.target.value) || 1 })}
                min={1}
                max={120}
                className="w-full bg-transparent border-b-[2px] border-white/70 text-white text-sm py-1 mt-1
                           focus:border-[#CCFF00] outline-none cursor-none"
              />
            </div>
          )}
        </div>

      </div>

      {/* Combo counter */}
      <div className="py-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-6 items-baseline">
            <span className="text-xs text-purple-400 font-bold">FILES: <span className="text-sm">{total}</span></span>
            <span className="text-xs text-purple-400 font-bold">SIZE: <span className="text-sm">{formatBytes(estSize)}</span></span>
          </div>
          <div>
            {capStatus === "green" && total > 0 && (
              <span className="text-white font-bold text-xs">WITHIN LIMITS</span>
            )}
            {capStatus === "amber" && (
              <span className="text-yellow-400 font-bold text-xs">LARGE BATCH</span>
            )}
            {capStatus === "red" && (
              <span className="text-red-400 font-bold text-xs">VERY LARGE BATCH</span>
            )}
            {capStatus === "blocked" && (
              <span className="text-purple-400 font-bold text-xs">
                EXCEEDS {BATCH_CAP.MAX} FILE LIMIT
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-2">
        <CaptureButton
          onCapture={async () => { dispatch({ type: "NEXT_STEP" }); }}
          text="Next"
          workingText="Next"
          successText="Next"
          minDuration={0}
          disabled={!canAdvance}
        />
      </div>
    </div>
  );
}
