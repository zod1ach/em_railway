/**
 * Batch Creation Wizard — 4-step flow.
 * Orchestrates step navigation, state management via useReducer, and batch creation API call.
 */

import { useReducer, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ProjectFile, CableSubType, BatchMode } from "@/types/project-files";
import {
  wizardReducer,
  createInitialState,
} from "./batch-wizard-reducer";
import { BatchWizardStepName } from "./batch-wizard-step-name";
import { BatchWizardStepType } from "./batch-wizard-step-type";
import { BatchWizardStepSweeps } from "./batch-wizard-step-sweeps";
import { BatchWizardStepLocation } from "./batch-wizard-step-location";
import { BatchWizardStepReview } from "./batch-wizard-step-review";
import { createBatch, type CreateBatchInput } from "@/lib/batch-files";
import {
  HVAC_CORE_PARAMS,
  HVAC_MAGNETIC_PARAMS,
  DC_CABLE_PARAMS,
  type ParamDef,
} from "@/lib/shared-param-defs";

interface Props {
  projectId: string;
  parentFile: ProjectFile;
  parentFileData: Record<string, any>;
  onClose: () => void;
  onCreated: () => void;
}

const stepAnimation = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
  transition: { duration: 0.2 },
};

export function BatchWizard({ projectId, parentFile, parentFileData, onClose, onCreated }: Props) {
  const cableType = parentFile.sub_type as CableSubType;
  const isMagnetic = parentFileData?.magnetic ?? false;
  const defaultMode: BatchMode = cableType === "hvac"
    ? (isMagnetic ? "magnetic" : "non_magnetic")
    : "cable";

  const [state, dispatch] = useReducer(wizardReducer, createInitialState(cableType, defaultMode));

  // Available params based on cable type + batch mode
  const availableParams: ParamDef[] = useMemo(() => {
    if (cableType === "hvac") {
      return state.batchMode === "magnetic"
        ? [...HVAC_CORE_PARAMS, ...HVAC_MAGNETIC_PARAMS]
        : [...HVAC_CORE_PARAMS];
    }
    // DC Bipole cable mode — only cable params (not earth field)
    return [...DC_CABLE_PARAMS];
  }, [cableType, state.batchMode]);

  const baseValues: Record<string, string> = parentFileData?.params ?? {};

  const handleGenerate = useCallback(async () => {
    dispatch({ type: "SET_GENERATING", generating: true });
    dispatch({ type: "SET_ERROR", error: "" });

    try {
      const isLocation = state.batchMode === "location";
      const enabledSweeps = isLocation
        ? []
        : state.sweepRows.filter((r) => r.enabled && r.values.length > 0);

      const input: CreateBatchInput = {
        name: state.name,
        tag: state.tag,
        parent_file_id: parentFile.id,
        cable_model_type: cableType,
        batch_mode: state.batchMode,
        sweep_parameters: enabledSweeps.map((s) => ({
          key: s.key,
          label: s.label,
          unit: s.unit,
          min: Math.min(...s.values),
          max: Math.max(...s.values),
          step: s.mode === "range" ? parseFloat(s.step) : null,
          values: s.values,
        })),
        ...(isLocation ? {
          location_config: {
            waypoints: state.location.waypoints,
            total_points: state.location.numPoints,
            interpolation: "linear" as const,
            date_sweep: {
              mode: state.location.dateSweepMode,
              start_date: state.location.startDate,
              end_date: state.location.endDate,
              num_months: state.location.numMonths,
            },
          },
        } : {}),
      };

      await createBatch(projectId, input);
      onCreated();
    } catch (err: any) {
      dispatch({ type: "SET_ERROR", error: err.message ?? "Failed to generate batch" });
    } finally {
      dispatch({ type: "SET_GENERATING", generating: false });
    }
  }, [state, projectId, parentFile.id, cableType, onCreated]);

  // Step indicator
  const steps = ["Name", "Type", "Sweeps", "Review"];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-white text-xl font-bold">Batch Wizard</h2>
          <div className="flex gap-2 mt-2">
            {steps.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2 | 3 | 4;
              const isCurrent = stepNum === state.step;
              const isVisited = stepNum < state.step;
              const canClick = isVisited;

              return (
                <div key={label} className="flex items-center gap-1">
                  <button
                    onClick={() => canClick && dispatch({ type: "GO_TO_STEP", step: stepNum })}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      isCurrent
                        ? "bg-[#CCFF00] text-black"
                        : isVisited
                          ? "bg-[#CCFF00]/20 text-[#CCFF00] cursor-none hover:bg-[#CCFF00]/40"
                          : "bg-[#222] text-[#555]"
                    }`}
                    disabled={!canClick}
                  >
                    {stepNum}
                  </button>
                  <span
                    className={`text-[10px] ${
                      isCurrent ? "text-white" : isVisited ? "text-[#CCFF00]/60" : "text-[#555]"
                    } ${canClick ? "cursor-none" : ""}`}
                    onClick={() => canClick && dispatch({ type: "GO_TO_STEP", step: stepNum })}
                  >
                    {label}
                  </span>
                  {i < steps.length - 1 && (
                    <div className="w-4 h-px bg-[#333] mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {state.step === 1 && (
            <motion.div key="step1" {...stepAnimation}>
              <BatchWizardStepName
                state={state}
                dispatch={dispatch}
                projectId={projectId}
                parentFileName={parentFileData?.name ?? parentFile.name}
                parentTag={parentFileData?.tag ?? ""}
              />
            </motion.div>
          )}
          {state.step === 2 && (
            <motion.div key="step2" {...stepAnimation}>
              <BatchWizardStepType
                state={state}
                dispatch={dispatch}
                parentMagnetic={isMagnetic}
              />
            </motion.div>
          )}
          {state.step === 3 && (
            <motion.div key="step3" {...stepAnimation}>
              {state.batchMode === "location" ? (
                <BatchWizardStepLocation
                  state={state}
                  dispatch={dispatch}
                />
              ) : (
                <BatchWizardStepSweeps
                  state={state}
                  dispatch={dispatch}
                  availableParams={availableParams}
                  baseValues={baseValues}
                />
              )}
            </motion.div>
          )}
          {state.step === 4 && (
            <motion.div key="step4" {...stepAnimation}>
              <BatchWizardStepReview
                state={state}
                dispatch={dispatch}
                onGenerate={handleGenerate}
                baseValues={baseValues}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
