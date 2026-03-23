/**
 * Wizard Step 4: Review configuration and generate batch files.
 */

import { estimateSizeBytes, formatBytes } from "@/lib/sweep-utils";
import { BATCH_CAP, AVG_FILE_SIZES } from "@/lib/shared-param-defs";
import { CaptureButton } from "@/components/ui/capture-button";
import type { WizardState, WizardAction } from "./batch-wizard-reducer";

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onGenerate: () => Promise<void> | void;
  baseValues: Record<string, string>;
}

export function BatchWizardStepReview({ state, dispatch, onGenerate, baseValues }: Props) {
  const enabledSweeps = state.sweepRows.filter((r) => r.enabled && r.values.length > 0);
  const fixedParams = state.sweepRows.filter((r) => !r.enabled);
  const sizeKey = state.cableModelType === "hvac"
    ? (state.batchMode === "magnetic" ? "hvac_magnetic" : "hvac_non_magnetic")
    : "dc_cable";
  const estSize = estimateSizeBytes(state.totalCombinations, AVG_FILE_SIZES[sizeKey] ?? 12_000);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-white text-lg font-semibold mb-1">Review & Generate</h3>
        <p className="text-[#888] text-sm">Confirm batch configuration before generating files</p>
      </div>

      {/* Summary */}
      <div className="space-y-2 text-sm">
        <div className="flex">
          <span className="text-[#888] w-16">Name:</span>
          <span className="text-white">{state.name}</span>
        </div>
        <div className="flex">
          <span className="text-[#888] w-16">Tag:</span>
          <span className="text-purple-400 font-mono">@{state.tag}</span>
        </div>
        <div className="flex">
          <span className="text-[#888] w-16">Type:</span>
          <span className="text-white capitalize">
            {state.cableModelType.toUpperCase()} — {state.batchMode.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Swept parameters */}
      <div>
        <h4 className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider mb-2">
          Swept Parameters ({enabledSweeps.length})
        </h4>
        <div className="space-y-1">
          {enabledSweeps.map((s) => (
            <div key={s.key} className="flex items-center text-sm text-[#ccc]">
              <span className="text-white font-medium w-32">{s.label}:</span>
              {s.mode === "range" ? (
                <span>
                  {s.min} to {s.max} with step size {s.step}
                  <span className="text-[#888] ml-1">({s.values.length})</span>
                </span>
              ) : (
                <span>
                  [{s.listValues}]
                  <span className="text-[#888] ml-1">({s.values.length})</span>
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Fixed parameters as table */}
      {fixedParams.length > 0 && (
        <div>
          <h4 className="text-[#888] text-[11px] font-bold uppercase tracking-wider mb-2">
            Fixed Parameters ({fixedParams.length}) — from parent snapshot
          </h4>
          <div className="overflow-x-auto">
            <table className="text-xs">
              <thead>
                <tr className="border-b border-[#222]">
                  {fixedParams.map((p) => (
                    <th key={p.key} className="text-[#CCFF00] text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 text-center">
                      {p.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {fixedParams.map((p) => (
                    <td key={p.key} className="text-white text-xs px-3 py-1.5 text-center font-mono">
                      {baseValues[p.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Error */}
      {state.error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{state.error}</p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-4">
          <span className="text-purple-400 text-xs font-bold">FILES: {state.totalCombinations}</span>
          <span className="text-purple-400 text-xs font-bold">SIZE: {formatBytes(estSize)}</span>
        </div>
        <CaptureButton
          onCapture={async () => { await onGenerate(); }}
          text={`Generate ${state.totalCombinations} Files`}
          workingText="Generating..."
          successText="Done!"
          minDuration={1500}
          disabled={state.isGenerating || state.totalCombinations > BATCH_CAP.MAX}
        />
      </div>
    </div>
  );
}
