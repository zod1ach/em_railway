/**
 * Wizard Step 1: Batch name + @tag input.
 * Auto-suggests tag from name, validates uniqueness in real-time.
 */

import { useEffect, useRef } from "react";
import type { WizardState, WizardAction } from "./batch-wizard-reducer";
import { checkTagUnique } from "@/lib/batch-files";
import { CaptureButton } from "@/components/ui/capture-button";

interface Props {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  projectId: string;
  parentFileName: string;
  parentTag: string;
}

export function BatchWizardStepName({
  state,
  dispatch,
  projectId,
  parentFileName,
  parentTag,
}: Props) {
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounced tag uniqueness check
  useEffect(() => {
    if (!state.tag) return;

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const isUnique = await checkTagUnique(projectId, state.tag);
      if (!isUnique) {
        dispatch({ type: "SET_TAG_ERROR", error: `Tag @${state.tag} already exists` });
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [state.tag, projectId, dispatch]);

  const canAdvance = state.name.trim().length > 0 && state.tag.length > 0 && !state.tagError;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-white text-lg font-semibold mb-1">Create Batch</h3>
        <p className="text-[#888] text-sm">
          <span className="text-[#CCFF00]">Parent:</span> <span className="text-white">{parentFileName}</span>
          {parentTag && (
            <span className="text-purple-400 ml-2">@{parentTag}</span>
          )}
        </p>
        <p className="text-white text-xs font-bold mt-1">
          Base config will be snapshot from parent file
        </p>
      </div>

      {/* Batch Name */}
      <div>
        <label className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider block mb-2">
          Batch Name
        </label>
        <input
          type="text"
          value={state.name}
          onChange={(e) => dispatch({ type: "SET_NAME", name: e.target.value })}
          placeholder="e.g., Current Sweep"
          className="w-full bg-transparent border-b border-[#333] text-white text-sm
                     py-2 px-1 focus:border-[#CCFF00] focus:outline-none transition-colors
                     placeholder:text-[#444] cursor-none"
          autoFocus
        />
      </div>

      {/* @tag */}
      <div>
        <label className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider block mb-2">
          @tag <span className="text-[#555] font-normal">(flow identifier)</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[#888] text-sm">@</span>
          <input
            type="text"
            value={state.tag}
            onChange={(e) => dispatch({ type: "SET_TAG", tag: e.target.value })}
            placeholder="auto_generated_from_name"
            className="flex-1 bg-transparent border-b border-[#333] text-white text-sm
                       py-2 px-1 focus:border-[#CCFF00] focus:outline-none transition-colors
                       placeholder:text-[#444] font-mono cursor-none"
          />
        </div>
        {state.tagError && (
          <p className="text-red-400 text-xs mt-1">{state.tagError}</p>
        )}
      </div>

      {/* Next */}
      <div className="flex justify-end pt-4">
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
