/**
 * Sortable, paginated results table for batch runs.
 * Click to select, Shift+Click for range select, Ctrl+Click to toggle.
 * Drag to select multiple rows.
 */

import { useState, useCallback, useRef } from "react";
import { motion } from "motion/react";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { BatchRun, SweepParameter } from "@/types/project-files";

interface BatchResultsTableProps {
  runs: BatchRun[];
  sweepAxes: SweepParameter[];
  selectedIds: Set<string>;
  onToggleSelect: (fileId: string) => void;
  onSelectRange: (fileIds: string[]) => void;
  onOpenRun: (run: BatchRun) => void;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (key: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalFiltered: number;
}

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ChevronUp size={10} className="text-[#333]" />;
  return dir === "asc"
    ? <ChevronUp size={10} className="text-[#CCFF00]" />
    : <ChevronDown size={10} className="text-[#CCFF00]" />;
}

export function BatchResultsTable({
  runs,
  sweepAxes,
  selectedIds,
  onToggleSelect,
  onSelectRange,
  onOpenRun,
  sortKey,
  sortDir,
  onSort,
  page,
  totalPages,
  onPageChange,
  totalFiltered,
}: BatchResultsTableProps) {
  const paramCols = sweepAxes.map((a) => ({ key: a.key, label: a.label, unit: a.unit }));
  const calcCols = [
    { key: "calc_peak_b_field", label: "Peak B", unit: "T" },
    { key: "calc_peak_e_field", label: "Peak E", unit: "V/m" },
  ];

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartIdx = useRef<number | null>(null);
  const lastClickIdx = useRef<number | null>(null);

  const handleRowMouseDown = useCallback((e: React.MouseEvent, idx: number, fileId: string) => {
    // Shift+click: range select from last click
    if (e.shiftKey && lastClickIdx.current !== null) {
      const start = Math.min(lastClickIdx.current, idx);
      const end = Math.max(lastClickIdx.current, idx);
      const rangeIds = runs.slice(start, end + 1).map((r) => r.file_id);
      onSelectRange(rangeIds);
      return;
    }

    // Ctrl/Cmd+click: toggle single
    if (e.ctrlKey || e.metaKey) {
      onToggleSelect(fileId);
      lastClickIdx.current = idx;
      return;
    }

    // Plain click: start drag selection
    setIsDragging(true);
    dragStartIdx.current = idx;
    lastClickIdx.current = idx;
    onSelectRange([fileId]);
  }, [runs, onToggleSelect, onSelectRange]);

  const handleRowMouseEnter = useCallback((idx: number) => {
    if (!isDragging || dragStartIdx.current === null) return;
    const start = Math.min(dragStartIdx.current, idx);
    const end = Math.max(dragStartIdx.current, idx);
    const rangeIds = runs.slice(start, end + 1).map((r) => r.file_id);
    onSelectRange(rangeIds);
  }, [isDragging, runs, onSelectRange]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    dragStartIdx.current = null;
  }, []);

  return (
    <div className="space-y-3" onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
      {/* Table */}
      <div className="overflow-x-auto select-none">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#1a1a1a]">
              {/* Swept param columns */}
              {paramCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className="text-[#888] text-[11px] font-bold uppercase tracking-wider py-2 pr-4 cursor-none select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label} <span className="text-[#555] normal-case font-normal">({col.unit})</span>
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </div>
                </th>
              ))}
              {/* Calc columns */}
              {calcCols.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key)}
                  className="text-[#888] text-[11px] font-bold uppercase tracking-wider py-2 pr-4 cursor-none select-none"
                >
                  <div className="flex items-center gap-1">
                    {col.label} <span className="text-[#555] normal-case font-normal">({col.unit})</span>
                    <SortIcon active={sortKey === col.key} dir={sortDir} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td
                  colSpan={2 + paramCols.length + calcCols.length}
                  className="text-center text-[#555] text-sm py-8"
                >
                  No runs match the current filters
                </td>
              </tr>
            )}
            {runs.map((run, idx) => {
              const isSelected = selectedIds.has(run.file_id);
              return (
                <motion.tr
                  key={run.file_id}
                  className={`border-b border-[#1a1a1a] transition-colors cursor-none ${
                    isSelected
                      ? "bg-[#CCFF00]/[0.05] border-l-2 border-l-[#CCFF00]"
                      : "hover:bg-[#111]/50"
                  }`}
                  onMouseDown={(e) => handleRowMouseDown(e, idx, run.file_id)}
                  onMouseEnter={() => handleRowMouseEnter(idx)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1 }}
                >
                  {/* Param values */}
                  {paramCols.map((col) => (
                    <td key={col.key} className="text-white text-sm py-2 pr-4">
                      {run.params[col.key] ?? "—"}
                    </td>
                  ))}
                  {/* Calc values */}
                  <td className="text-white text-sm py-2 pr-4">
                    {run.calc_peak_b_field != null ? run.calc_peak_b_field.toExponential(3) : "—"}
                  </td>
                  <td className="text-white text-sm py-2 pr-4">
                    {run.calc_peak_e_field != null ? run.calc_peak_e_field.toExponential(3) : "—"}
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-[#555] text-xs">
          <span>
            Page {page} of {totalPages} ({totalFiltered} runs)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-2 py-1 rounded hover:bg-[#111] disabled:opacity-30 cursor-none transition-colors"
            >
              ◀
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => onPageChange(pageNum)}
                  className={`px-2 py-1 rounded cursor-none transition-colors ${
                    pageNum === page
                      ? "bg-[#CCFF00]/10 text-[#CCFF00]"
                      : "hover:bg-[#111]"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-2 py-1 rounded hover:bg-[#111] disabled:opacity-30 cursor-none transition-colors"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
