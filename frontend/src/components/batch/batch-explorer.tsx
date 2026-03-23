/**
 * Batch Explorer — main container component.
 * Orchestrates: summary bar → filter panel → results (table or grid) → action bar.
 */

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { CaptureButton } from "@/components/ui/capture-button";
import type { BatchFolder, ProjectFile, BatchRun } from "@/types/project-files";
import { useBatchData } from "@/hooks/use-batch-data";
import { useBatchFilter } from "@/hooks/use-batch-filter";
import { BatchFilterPanel } from "./batch-filter-panel";
import { BatchResultsTable } from "./batch-results-table";
import { BatchActionBar } from "./batch-action-bar";
import {
  HVAC_CORE_PARAMS,
  HVAC_MAGNETIC_PARAMS,
  DC_CABLE_PARAMS,
  DC_EARTH_PARAMS,
  type ParamDef,
} from "@/lib/shared-param-defs";

interface BatchExplorerProps {
  projectId: string;
  batchFolder: BatchFolder;
  parentFile: ProjectFile;
  onClose: () => void;
  onFileOpen: (fileId: string) => void;
}

export function BatchExplorer({
  projectId,
  batchFolder,
  parentFile,
  onClose,
  onFileOpen,
}: BatchExplorerProps) {
  const { batch, sweepAxes, allRuns, loading, error } = useBatchData(
    projectId,
    batchFolder.id,
  );

  const {
    filteredRuns,
    totalFiltered,
    pageRuns,
    totalPages,
    filters,
    sortKey,
    sortDir,
    page,
    distinctRemaining,
    setFilter,
    clearFilter,
    clearAllFilters,
    setSort,
    setPage,
    setExactFilter,
  } = useBatchFilter(allRuns, sweepAxes);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showData, setShowData] = useState(false);

  // Selection handlers
  const toggleSelect = useCallback((fileId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredRuns.map((r) => r.file_id)));
  }, [filteredRuns]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectRange = useCallback((fileIds: string[]) => {
    setSelectedIds(new Set(fileIds));
  }, []);

  const handleOpenRun = useCallback(
    (run: BatchRun) => {
      onFileOpen(run.file_id);
    },
    [onFileOpen],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="text-[#CCFF00] animate-spin" />
        <span className="text-[#555] text-sm ml-3">Loading batch data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <span className="text-red-400 text-sm">{error}</span>
        <button
          onClick={onClose}
          className="text-[#555] hover:text-white text-xs cursor-none"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.25 }}
      className="flex gap-8 items-start"
    >
      {/* Left: Explorer form */}
      <div className="space-y-5 min-w-[420px] max-w-[500px] shrink-0">
        {/* Header */}
        <div>
          <h2 className="text-[#CCFF00] text-xl font-bold">Batch Explorer</h2>
          <div className="flex items-center justify-between mt-1">
            <span className="text-white text-sm font-bold">{batchFolder.name} <span className="text-purple-400 font-normal">({allRuns.length})</span></span>
            <span className="text-purple-400 font-mono text-sm">@{batchFolder.tag}</span>
          </div>
        </div>

        {/* Parameter display — Fixed + Sweep */}
        <BatchParamDisplay
          batchFolder={batchFolder}
          baseParams={batch?.base_params ?? batchFolder.base_params}
          sweepAxes={sweepAxes}
          onToggleData={async () => setShowData((prev) => !prev)}
          showData={showData}
        />
      </div>

      {/* Right: Data table (side-by-side, aligned to top) */}
      <AnimatePresence>
        {showData && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="flex-1 space-y-4 min-w-0"
          >
            {/* Results */}
            <BatchResultsTable
                runs={pageRuns}
                sweepAxes={sweepAxes}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onSelectRange={selectRange}
                onOpenRun={handleOpenRun}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={setSort}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalFiltered={totalFiltered}
              />

            {/* Action bar */}
            <BatchActionBar
              selectedCount={selectedIds.size}
              onLoadToFlow={() => {
                /* TODO: flow loading — future N8N integration */
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ── Read-only parameter field (matches HVAC form ParamField style) ── */

function ReadOnlyField({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1 opacity-30 pointer-events-none">
      <span className="text-[11px] text-white font-bold">{label}</span>
      <div className="flex items-baseline gap-1 border-b-[2px] border-[#333] pb-1.5 pt-0.5">
        <span className="text-sm text-white whitespace-nowrap">{value || "—"}</span>
        {unit && <span className="text-sm font-bold text-[#555]">{unit}</span>}
      </div>
    </div>
  );
}

function SweepField({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-[#CCFF00] font-bold">{label}</span>
      <div className="flex items-baseline gap-1 border-b-[2px] border-[#CCFF00]/30 pb-1.5 pt-0.5">
        <span className="text-sm text-white whitespace-nowrap">{value || "—"}</span>
        {unit && <span className="text-sm font-bold text-white">{unit}</span>}
      </div>
    </div>
  );
}

/* ── Parameter display: Fixed params + Sweep params ── */

function BatchParamDisplay({
  batchFolder,
  baseParams,
  sweepAxes,
  onToggleData,
  showData,
}: {
  batchFolder: BatchFolder;
  baseParams: Record<string, string>;
  sweepAxes: import("@/types/project-files").SweepParameter[];
  onToggleData: () => Promise<void>;
  showData: boolean;
}) {
  // Get all param definitions based on cable type
  const allParams: ParamDef[] = useMemo(() => {
    if (batchFolder.cable_model_type === "hvac") {
      return batchFolder.batch_mode === "magnetic"
        ? [...HVAC_CORE_PARAMS, ...HVAC_MAGNETIC_PARAMS]
        : [...HVAC_CORE_PARAMS];
    }
    return [...DC_CABLE_PARAMS, ...DC_EARTH_PARAMS];
  }, [batchFolder.cable_model_type, batchFolder.batch_mode]);

  const sweptKeys = new Set(sweepAxes.map((a) => a.key));
  const fixedParams = allParams.filter((p) => !sweptKeys.has(p.key));
  const sweepParams = allParams.filter((p) => sweptKeys.has(p.key));

  // Parse base_params (might be JSON string)
  const params: Record<string, string> = useMemo(() => {
    if (typeof baseParams === "string") {
      try { return JSON.parse(baseParams); } catch { return {}; }
    }
    return baseParams ?? {};
  }, [baseParams]);

  // Chunk into rows of 3
  const chunkRows = (arr: ParamDef[]) => {
    const rows: ParamDef[][] = [];
    for (let i = 0; i < arr.length; i += 3) {
      rows.push(arr.slice(i, i + 3));
    }
    return rows;
  };

  const fixedRows = chunkRows(fixedParams);
  const sweepRows = chunkRows(sweepParams);

  return (
    <div>
      {/* Fixed parameters */}
      {fixedRows.length > 0 && (
        <div className="space-y-4">
          {fixedRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-4">
              {row.map((p) => (
                <ReadOnlyField
                  key={p.key}
                  label={p.label}
                  value={params[p.key] ?? String(p.default)}
                  unit={p.unit}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Separator */}
      <div className="relative my-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-[#0d0d0d] px-3 text-[9px] text-[#444] uppercase tracking-widest">
          Sweep
        </span>
      </div>

      {/* Sweep parameters */}
      {sweepRows.length > 0 && (
        <div className="space-y-4">
          {sweepRows.map((row, ri) => (
            <div key={ri} className="grid grid-cols-3 gap-4">
              {row.map((p) => {
                const axis = sweepAxes.find((a) => a.key === p.key);
                const sweepText = axis
                  ? `${axis.min} - ${axis.max} (${axis.step ?? "list"})`
                  : params[p.key] ?? String(p.default);
                return (
                  <SweepField
                    key={p.key}
                    label={p.label}
                    value={sweepText}
                    unit={p.unit}
                  />
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Show/Close Data button */}
      <div className="flex justify-end mt-4">
        <CaptureButton
          key={showData ? "close" : "show"}
          onCapture={onToggleData}
          text={showData ? "Close Data" : "Show Data"}
          workingText={showData ? "Close Data" : "Show Data"}
          successText={showData ? "Close Data" : "Show Data"}
          minDuration={0}
        />
      </div>
    </div>
  );
}
