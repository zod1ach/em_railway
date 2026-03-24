/**
 * Details panel — right 1/3 of bottom 1/6.
 * Shows file parameters for selected source/batch node.
 */

import { useEffect, useState } from "react";
import type { WorkflowNodeInstance } from "@/types/workflow-nodes";
import type { ProjectFile, BatchRun } from "@/types/project-files";
import { getBatchRuns } from "@/lib/batch-files";
import {
  HVAC_CORE_PARAMS,
  HVAC_MAGNETIC_PARAMS,
  DC_CABLE_PARAMS,
  DC_EARTH_PARAMS,
  type ParamDef,
} from "@/lib/shared-param-defs";

interface Props {
  nodes: readonly WorkflowNodeInstance[];
  selectedNodeId: string | null;
  files: ProjectFile[];
  getFileData: (projectId: string, fileId: string) => Promise<Record<string, any> | null>;
  projectId: string;
  onShowRunsTable?: (sweepConfig: any, batchDefType: string, batchTag: string, parentFileName: string, baseParams: Record<string, string>) => void;
}

const ALL_DEFS = [...HVAC_CORE_PARAMS, ...HVAC_MAGNETIC_PARAMS, ...DC_CABLE_PARAMS, ...DC_EARTH_PARAMS];

function getParamDefs(file: ProjectFile, fileData: Record<string, any> | null): ParamDef[] {
  if (file.sub_type === "hvac") {
    const isMagnetic = fileData?.magnetic ?? false;
    return isMagnetic ? [...HVAC_CORE_PARAMS, ...HVAC_MAGNETIC_PARAMS] : [...HVAC_CORE_PARAMS];
  }
  if (file.sub_type === "dc_bipole") return [...DC_CABLE_PARAMS, ...DC_EARTH_PARAMS];
  return [];
}

function fmtVal(v: unknown): string {
  if (v === undefined || v === null || v === "") return "-";
  const s = String(v);
  // If it looks like a date or non-numeric string, return as-is
  if (typeof v === "string" && !/^-?\d*\.?\d+(?:e[+-]?\d+)?$/i.test(s)) return s;
  const n = Number(v);
  if (isNaN(n)) return s;
  if (Math.abs(n) >= 1e4 || (Math.abs(n) < 1e-2 && n !== 0)) return n.toExponential(2).toUpperCase();
  return String(n);
}

interface SweepInfo {
  label: string;
  min: string;
  max: string;
  steps: number;
  unit: string;
}

function extractSweepsFromConfig(sweepConfig: any): SweepInfo[] {
  const sweeps: SweepInfo[] = [];
  if (!sweepConfig?.parameters || !Array.isArray(sweepConfig.parameters)) return sweeps;
  for (const param of sweepConfig.parameters) {
    sweeps.push({
      label: param.label ?? param.key,
      min: fmtVal(param.min ?? param.values?.[0]),
      max: fmtVal(param.max ?? param.values?.[param.values?.length - 1]),
      steps: param.step ?? 0,
      unit: param.unit ?? "",
    });
  }
  return sweeps;
}

/* ── Format a run's tag_path into a clean name ── */
function formatRunName(tagPath: string): string {
  // tag_path like "r_AC=0.05" or "r_AC=0.05/I_AC=500"
  return tagPath
    .split("/")
    .map((seg) => {
      const [key, val] = seg.split("=");
      const def = ALL_DEFS.find((d) => d.key === key);
      return `${def?.label ?? key} ${val}`;
    })
    .join("  ");
}

const BATCH_DEF_TYPES = new Set([
  "batch-hvac-nonmag", "batch-hvac-mixed", "batch-dc-cable", "batch-dc-location",
]);

const SOURCE_DEF_TYPES = new Set(["hvac-file", "dc-bipole-file", "wmm-file"]);

export function WorkflowDetailsPanel({ nodes, selectedNodeId, files, getFileData, projectId, onShowRunsTable }: Props) {
  const [fileData, setFileData] = useState<Record<string, any> | null>(null);
  const [batchRuns, setBatchRuns] = useState<BatchRun[]>([]);

  const selectedNode = selectedNodeId
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  const isSource = selectedNode ? SOURCE_DEF_TYPES.has(selectedNode.defType) : false;
  const isBatch = selectedNode ? BATCH_DEF_TYPES.has(selectedNode.defType) : false;
  const fileId = selectedNode?.config?.fileId as string | undefined;
  const file = fileId ? files.find((f) => f.id === fileId) : null;

  // Load file data for source nodes
  useEffect(() => {
    setFileData(null);
    if (!fileId || !isSource) return;
    let cancelled = false;
    getFileData(projectId, fileId).then((data) => {
      if (!cancelled) setFileData(data);
    });
    return () => { cancelled = true; };
  }, [fileId, isSource, getFileData, projectId]);

  // Load batch runs for batch nodes
  const [batchRunsLoading, setBatchRunsLoading] = useState(false);
  useEffect(() => {
    setBatchRuns([]);
    setBatchRunsLoading(false);
    if (!isBatch || !selectedNodeId) return;
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    const config = node.config as Record<string, any>;
    const fileIdsStr = typeof config?.fileIds === "string" ? config.fileIds : "";
    const batchId = fileIdsStr.split(",")[0];
    if (!batchId) return;
    setBatchRunsLoading(true);
    let cancelled = false;
    getBatchRuns(projectId, batchId, 1, 50).then((res) => {
      if (!cancelled) {
        setBatchRuns(res.runs);
        setBatchRunsLoading(false);
      }
    }).catch((err) => {
      console.error("[WorkflowDetailsPanel] getBatchRuns failed:", batchId, err);
      if (!cancelled) setBatchRunsLoading(false);
    });
    return () => { cancelled = true; };
  }, [isBatch, selectedNodeId, nodes, projectId]);

  // Nothing selected
  if (!selectedNode || (!isSource && !isBatch)) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-[9px] uppercase tracking-[0.25em] text-[#333]">
          SELECT A NODE
        </span>
      </div>
    );
  }

  // ── BATCH NODE ──
  if (isBatch) {
    const config = selectedNode.config as Record<string, any>;
    const rawBatchInfo = config?.batchInfo ?? {};

    // Parse JSON strings if needed (backend stores them as strings)
    const parsedSweepConfig = typeof rawBatchInfo.sweep_config === "string"
      ? JSON.parse(rawBatchInfo.sweep_config) : rawBatchInfo.sweep_config ?? {};
    const parsedBaseParams = typeof rawBatchInfo.base_params === "string"
      ? JSON.parse(rawBatchInfo.base_params) : rawBatchInfo.base_params ?? {};

    const batchInfo = { ...rawBatchInfo, sweep_config: parsedSweepConfig, base_params: parsedBaseParams };
    const sweeps = extractSweepsFromConfig(parsedSweepConfig);
    const totalRuns = batchInfo.total_runs ?? config?.fileCount ?? 0;

    // Get swept param keys to exclude from fixed list
    const sweptKeys = new Set(
      (parsedSweepConfig?.parameters ?? []).map((p: any) => p.key)
    );

    // Filter base_params: exclude swept keys, empty values, and grid params
    const rawBase = parsedBaseParams;
    const baseParams = Object.fromEntries(
      Object.entries(rawBase).filter(([key, val]) => {
        if (sweptKeys.has(key)) return false;
        if (val === "" || val === undefined || val === null) return false;
        // Only show params we have defs for (skip internal/unknown keys)
        return ALL_DEFS.some((d) => d.key === key);
      })
    );

    const nodeTitle = selectedNode.defType === "batch-hvac-nonmag" ? "BATCH HVAC (NM)"
      : selectedNode.defType === "batch-hvac-mixed" ? "BATCH HVAC (M)"
      : selectedNode.defType === "batch-dc-cable" ? "BATCH DC BIPOLE (C)"
      : "BATCH DC BIPOLE (L)";

    return (
      <div className="flex h-full flex-col overflow-auto p-2">
        {/* Title + run count + full table button */}
        <div className="mb-1.5 flex items-center justify-between">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            {nodeTitle}
            <span className="ml-2 font-normal text-[#666]">({totalRuns})</span>
          </div>
          {sweeps.length > 0 && onShowRunsTable && (
            <button
              onClick={() => onShowRunsTable(parsedSweepConfig, selectedNode.defType, batchInfo.batchTag ?? batchInfo.name ?? "", batchInfo.parentFileName ?? "", parsedBaseParams)}
              className="cursor-none text-[8px] font-bold uppercase tracking-[0.15em] text-[#CCFF00] hover:text-white transition-colors"
            >
              FULL TABLE
            </button>
          )}
        </div>

        {/* FIXED */}
        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#a78bfa]">
          FIXED
        </div>
        {Object.keys(baseParams).length > 0 ? (
          <div className="mb-1.5 space-y-px">
            {Object.entries(baseParams).map(([key, val]) => {
              const def = ALL_DEFS.find((d) => d.key === key);
              return (
                <div key={key} className="flex justify-between text-[9px] uppercase tracking-[0.1em]">
                  <span className="text-[#888]">{def?.label ?? key}</span>
                  <span className="text-white">{fmtVal(val)} {def?.unit ?? ""}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mb-1.5 text-[9px] text-[#444]">-</div>
        )}

        {/* Divider */}
        <div className="mb-1.5 border-t border-[#1a1a1a]" />

        {/* SWEPT */}
        <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#CCFF00]">
          SWEPT
        </div>
        {sweeps.length > 0 ? (
          <div className="space-y-0.5">
            {sweeps.map((s) => (
              <div key={s.label} className="flex justify-between text-[9px] uppercase tracking-[0.1em]">
                <span className="text-white">{s.label}</span>
                <span className="text-[#888]">
                  {s.min} -- {s.max} -- {fmtVal(s.steps)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[9px] text-[#444]">-</div>
        )}
      </div>
    );
  }

  // ── SINGLE FILE SOURCE NODE ──
  const fileName = (selectedNode.config?.fileName as string) ?? file?.name ?? "UNKNOWN";
  const configParams = selectedNode.config?.params as Record<string, number> | undefined;
  const fromBatchRun = !!selectedNode.config?.fromBatchRun;

  // For batch-run-derived nodes, use config.params directly
  // For regular file nodes, use fileData from API
  const effectiveData = fromBatchRun && configParams
    ? { params: configParams }
    : fileData;

  // Determine param defs — for batch run nodes without a file, infer from defType
  let paramDefs: ParamDef[] = [];
  if (file) {
    paramDefs = getParamDefs(file, effectiveData);
  } else if (fromBatchRun) {
    // Infer from defType
    if (selectedNode.defType === "hvac-file") paramDefs = [...HVAC_CORE_PARAMS];
    else if (selectedNode.defType === "dc-bipole-file") paramDefs = [...DC_CABLE_PARAMS, ...DC_EARTH_PARAMS];
  }

  // Resolve @tag
  const tag = fromBatchRun
    ? (selectedNode.config?.batchTag as string) ?? ""
    : effectiveData?.tag ?? "";

  return (
    <div className="flex h-full flex-col overflow-auto p-2">
      <div className="mb-0.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white">
        {fileName}
      </div>
      {tag && (
        <div className="mb-1.5 text-[9px] uppercase tracking-[0.15em] text-[#555]">
          @{tag}
        </div>
      )}
      {effectiveData ? (
        <div className="space-y-0.5">
          {paramDefs.length > 0 ? (
            paramDefs.map((def) => {
              const val = effectiveData.params?.[def.key] ?? (effectiveData as any)[def.key];
              return (
                <div key={def.key} className="flex justify-between text-[10px] uppercase tracking-[0.1em]">
                  <span className="text-[#888]">{def.label}</span>
                  <span className="text-white">{fmtVal(val)} {def.unit}</span>
                </div>
              );
            })
          ) : configParams ? (
            // Fallback: show raw param keys if no defs matched
            Object.entries(configParams).map(([key, val]) => {
              const def = ALL_DEFS.find((d) => d.key === key);
              return (
                <div key={key} className="flex justify-between text-[10px] uppercase tracking-[0.1em]">
                  <span className="text-[#888]">{def?.label ?? key}</span>
                  <span className="text-white">{fmtVal(val)} {def?.unit ?? ""}</span>
                </div>
              );
            })
          ) : null}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.15em] text-[#444]">LOADING</span>
        </div>
      )}
    </div>
  );
}
