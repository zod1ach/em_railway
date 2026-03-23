/**
 * State management for the 4-step batch creation wizard.
 * Pure reducer — all state transitions are explicit and testable.
 */

import type { BatchMode, CableSubType } from "@/types/project-files";
import { generateValues, countCombinations } from "@/lib/sweep-utils";
import type { ParamDef } from "@/lib/shared-param-defs";

/* ── Sweep Row State ── */

export interface SweepRow {
  key: string;
  label: string;
  unit: string;
  enabled: boolean;
  mode: "range" | "list";
  min: string;
  max: string;
  step: string;
  listValues: string; // comma-separated
  values: number[];   // computed discrete values
}

/* ── Wizard State ── */

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  name: string;
  tag: string;
  tagError: string;
  cableModelType: CableSubType;
  batchMode: BatchMode;
  sweepRows: SweepRow[];
  totalCombinations: number;
  isGenerating: boolean;
  error: string;
}

/* ── Actions ── */

export type WizardAction =
  | { type: "SET_NAME"; name: string }
  | { type: "SET_TAG"; tag: string }
  | { type: "SET_TAG_ERROR"; error: string }
  | { type: "SET_BATCH_MODE"; mode: BatchMode }
  | { type: "TOGGLE_SWEEP"; key: string }
  | { type: "SET_SWEEP_MODE"; key: string; mode: "range" | "list" }
  | { type: "SET_SWEEP_MIN"; key: string; value: string }
  | { type: "SET_SWEEP_MAX"; key: string; value: string }
  | { type: "SET_SWEEP_STEP"; key: string; value: string }
  | { type: "SET_SWEEP_LIST"; key: string; values: string }
  | { type: "NEXT_STEP" }
  | { type: "PREV_STEP" }
  | { type: "GO_TO_STEP"; step: 1 | 2 | 3 | 4 }
  | { type: "SET_GENERATING"; generating: boolean }
  | { type: "SET_ERROR"; error: string }
  | { type: "INIT_SWEEP_ROWS"; params: ParamDef[] };

/* ── Initial State Factory ── */

export function createInitialState(
  cableModelType: CableSubType,
  batchMode: BatchMode,
): WizardState {
  return {
    step: 1,
    name: "",
    tag: "",
    tagError: "",
    cableModelType,
    batchMode,
    sweepRows: [],
    totalCombinations: 0,
    isGenerating: false,
    error: "",
  };
}

/* ── Reducer ── */

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_NAME": {
      const tag = action.name
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 50);
      return { ...state, name: action.name, tag, tagError: "" };
    }

    case "SET_TAG":
      return { ...state, tag: action.tag, tagError: "" };

    case "SET_TAG_ERROR":
      return { ...state, tagError: action.error };

    case "SET_BATCH_MODE":
      return { ...state, batchMode: action.mode };

    case "INIT_SWEEP_ROWS": {
      const rows: SweepRow[] = action.params.map((p) => ({
        key: p.key,
        label: p.label,
        unit: p.unit,
        enabled: false,
        mode: "range",
        min: "",
        max: "",
        step: "",
        listValues: "",
        values: [],
      }));
      return { ...state, sweepRows: rows, totalCombinations: 0 };
    }

    case "TOGGLE_SWEEP": {
      const rows = state.sweepRows.map((r) =>
        r.key === action.key ? { ...r, enabled: !r.enabled } : r,
      );
      return recomputeCombinations({ ...state, sweepRows: rows });
    }

    case "SET_SWEEP_MODE": {
      const rows = state.sweepRows.map((r) =>
        r.key === action.key ? { ...r, mode: action.mode, values: [] } : r,
      );
      return recomputeCombinations({ ...state, sweepRows: rows });
    }

    case "SET_SWEEP_MIN": {
      const rows = state.sweepRows.map((r) => {
        if (r.key !== action.key) return r;
        const updated = { ...r, min: action.value };
        return recomputeRowValues(updated);
      });
      return recomputeCombinations({ ...state, sweepRows: rows });
    }

    case "SET_SWEEP_MAX": {
      const rows = state.sweepRows.map((r) => {
        if (r.key !== action.key) return r;
        const updated = { ...r, max: action.value };
        return recomputeRowValues(updated);
      });
      return recomputeCombinations({ ...state, sweepRows: rows });
    }

    case "SET_SWEEP_STEP": {
      const rows = state.sweepRows.map((r) => {
        if (r.key !== action.key) return r;
        const updated = { ...r, step: action.value };
        return recomputeRowValues(updated);
      });
      return recomputeCombinations({ ...state, sweepRows: rows });
    }

    case "SET_SWEEP_LIST": {
      const rows = state.sweepRows.map((r) => {
        if (r.key !== action.key) return r;
        const values = action.values
          .split(",")
          .map((v) => parseFloat(v.trim()))
          .filter((v) => !isNaN(v));
        return { ...r, listValues: action.values, values };
      });
      return recomputeCombinations({ ...state, sweepRows: rows });
    }

    case "NEXT_STEP":
      return state.step < 4
        ? { ...state, step: (state.step + 1) as WizardState["step"] }
        : state;

    case "PREV_STEP":
      return state.step > 1
        ? { ...state, step: (state.step - 1) as WizardState["step"] }
        : state;

    case "GO_TO_STEP":
      // Only allow going back to already-visited steps
      return action.step < state.step
        ? { ...state, step: action.step }
        : state;

    case "SET_GENERATING":
      return { ...state, isGenerating: action.generating };

    case "SET_ERROR":
      return { ...state, error: action.error };

    default:
      return state;
  }
}

/* ── Helpers ── */

function recomputeRowValues(row: SweepRow): SweepRow {
  if (row.mode === "list") return row;

  const min = parseFloat(row.min);
  const max = parseFloat(row.max);
  const step = parseFloat(row.step);

  if (isNaN(min) || isNaN(max) || isNaN(step) || step <= 0) {
    return { ...row, values: [] };
  }

  return { ...row, values: generateValues(min, max, step) };
}

function recomputeCombinations(state: WizardState): WizardState {
  const enabled = state.sweepRows.filter((r) => r.enabled && r.values.length > 0);
  const valueSets = enabled.map((r) => r.values);
  const total = countCombinations(valueSets);
  return { ...state, totalCombinations: total };
}
