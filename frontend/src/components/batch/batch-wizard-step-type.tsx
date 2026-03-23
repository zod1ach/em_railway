/**
 * Wizard Step 2: Batch type configuration.
 * HVAC: Magnetic / Non-Magnetic toggle.
 * DC Bipole: Cable Mode / Location Mode selection.
 */

import type { BatchMode, CableSubType } from "@/types/project-files";
import type { WizardState, WizardAction } from "./batch-wizard-reducer";
import { CaptureButton } from "@/components/ui/capture-button";

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  parentMagnetic?: boolean;
}

const HVAC_OPTIONS: { value: BatchMode; label: string; description: string }[] = [
  { value: "non_magnetic", label: "Non-Magnetic", description: "Standard HVAC calculation without armour effects" },
  { value: "magnetic", label: "Magnetic", description: "Includes magnetic armour parameters in sweep" },
];

const DC_OPTIONS: { value: BatchMode; label: string; description: string }[] = [
  { value: "cable", label: "Cable Mode", description: "Sweep cable parameters for one fixed location" },
  { value: "location", label: "Location Mode", description: "Sweep a fixed cable model across multiple locations (transect line)" },
];

export function BatchWizardStepType({ state, dispatch, parentMagnetic }: Props) {
  const options = state.cableModelType === "hvac" ? HVAC_OPTIONS : DC_OPTIONS;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white text-lg font-semibold mb-1">Batch Mode</h3>
        <p className="text-[#888] text-sm">
          {state.cableModelType === "hvac"
            ? "Choose calculation type for this batch"
            : "Choose how parameters will be swept."}
        </p>
        {state.cableModelType === "hvac" && parentMagnetic !== undefined && (
          <p className="text-white text-xs font-bold mt-1">
            Parent is configured as: {parentMagnetic ? "Magnetic" : "Non-Magnetic"}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => dispatch({ type: "SET_BATCH_MODE", mode: opt.value })}
            className={`w-full text-left p-4 rounded-xl border transition-all cursor-none ${
              state.batchMode === opt.value
                ? "border-[#CCFF00] bg-[#CCFF00]/[0.05]"
                : "border-[#222] bg-[#111] hover:border-[#333]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  state.batchMode === opt.value
                    ? "border-[#CCFF00]"
                    : "border-[#555]"
                }`}
              >
                {state.batchMode === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-[#CCFF00]" />
                )}
              </div>
              <div>
                <p className="text-white text-sm font-medium">{opt.label}</p>
                <p className="text-[#888] text-xs mt-0.5">{opt.description}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-end pt-4">
        <CaptureButton
          onCapture={async () => { dispatch({ type: "NEXT_STEP" }); }}
          text="Next"
          workingText="Next"
          successText="Next"
          minDuration={0}
        />
      </div>
    </div>
  );
}
