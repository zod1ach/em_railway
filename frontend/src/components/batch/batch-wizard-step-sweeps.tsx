/**
 * Wizard Step 3: Configure parameter sweeps.
 * Shows all available params as toggleable sweep rows with live combo counter.
 */

import { useEffect } from "react";
import type { WizardState, WizardAction } from "./batch-wizard-reducer";
import { SweepParamRow } from "./sweep-param-row";
import { CaptureButton } from "@/components/ui/capture-button";
import { estimateSizeBytes, formatBytes } from "@/lib/sweep-utils";
import { BATCH_CAP, AVG_FILE_SIZES } from "@/lib/shared-param-defs";
import type { ParamDef } from "@/lib/shared-param-defs";

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  availableParams: ParamDef[];
  baseValues: Record<string, string>;
}

export function BatchWizardStepSweeps({ state, dispatch, availableParams, baseValues }: Props) {
  // Initialize sweep rows from available params
  useEffect(() => {
    if (state.sweepRows.length === 0 && availableParams.length > 0) {
      dispatch({ type: "INIT_SWEEP_ROWS", params: availableParams });
    }
  }, [availableParams, state.sweepRows.length, dispatch]);

  const total = state.totalCombinations;
  const sizeKey = state.cableModelType === "hvac"
    ? (state.batchMode === "magnetic" ? "hvac_magnetic" : "hvac_non_magnetic")
    : "dc_cable";
  const estSize = estimateSizeBytes(total, AVG_FILE_SIZES[sizeKey] ?? 12_000);

  const capStatus =
    total > BATCH_CAP.MAX
      ? "blocked"
      : total > BATCH_CAP.AMBER
        ? "red"
        : total > BATCH_CAP.GREEN
          ? "amber"
          : "green";

  const enabledCount = state.sweepRows.filter((r) => r.enabled).length;
  const canAdvance = total > 0 && total <= BATCH_CAP.MAX;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white text-lg font-semibold mb-1">Configure Sweeps</h3>
        <p className="text-[#888] text-sm">
          Enable parameters to sweep and define their ranges
        </p>
      </div>

      {/* Sweep rows */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {state.sweepRows.map((row) => (
          <SweepParamRow
            key={row.key}
            row={row}
            baseValue={baseValues[row.key] ?? String(availableParams.find((p) => p.key === row.key)?.default ?? "")}
            dispatch={dispatch}
          />
        ))}
      </div>

      {/* Combo counter */}
      <div className="py-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-6 items-baseline">
            <span className="text-xs text-purple-400 font-bold">FILES: <span className="text-sm">{total}</span></span>
            <span className="text-xs text-purple-400 font-bold">SIZE: <span className="text-sm">{formatBytes(estSize)}</span></span>
          </div>

          <div>
            {capStatus === "green" && (
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
