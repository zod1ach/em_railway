/**
 * Client-side batch run filtering with progressive narrowing.
 * Filters all runs in memory (max 500), computes distinct remaining values.
 */

import { useState, useMemo, useCallback } from "react";
import type { BatchRun, SweepParameter } from "@/types/project-files";

export interface RangeFilter {
  key: string;
  min?: number;
  max?: number;
}

interface FilterState {
  filters: RangeFilter[];
  sortKey: string;
  sortDir: "asc" | "desc";
  page: number;
  perPage: number;
}

interface BatchFilterResult {
  filteredRuns: BatchRun[];
  totalFiltered: number;
  pageRuns: BatchRun[];
  totalPages: number;
  filters: RangeFilter[];
  sortKey: string;
  sortDir: "asc" | "desc";
  page: number;
  distinctRemaining: Record<string, number[]>;
  setFilter: (key: string, min?: number, max?: number) => void;
  clearFilter: (key: string) => void;
  clearAllFilters: () => void;
  setSort: (key: string) => void;
  setPage: (page: number) => void;
  setExactFilter: (key: string, value: number) => void;
}

export function useBatchFilter(
  allRuns: BatchRun[],
  sweepAxes: SweepParameter[],
  perPage = 50,
): BatchFilterResult {
  const [state, setState] = useState<FilterState>({
    filters: [],
    sortKey: "run_number",
    sortDir: "asc",
    page: 1,
    perPage,
  });

  // Apply all active filters (AND logic)
  const filteredRuns = useMemo(() => {
    if (state.filters.length === 0) return allRuns;

    return allRuns.filter((run) =>
      state.filters.every((f) => {
        const val = run.params[f.key];
        if (val === undefined) return false;
        if (f.min !== undefined && val < f.min - 1e-9) return false;
        if (f.max !== undefined && val > f.max + 1e-9) return false;
        return true;
      }),
    );
  }, [allRuns, state.filters]);

  // Sort filtered runs
  const sortedRuns = useMemo(() => {
    const sorted = [...filteredRuns];
    sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (state.sortKey === "run_number") {
        aVal = a.run_number;
        bVal = b.run_number;
      } else if (state.sortKey === "calc_peak_b_field") {
        aVal = a.calc_peak_b_field ?? 0;
        bVal = b.calc_peak_b_field ?? 0;
      } else if (state.sortKey === "calc_peak_e_field") {
        aVal = a.calc_peak_e_field ?? 0;
        bVal = b.calc_peak_e_field ?? 0;
      } else {
        aVal = a.params[state.sortKey] ?? 0;
        bVal = b.params[state.sortKey] ?? 0;
      }
      return state.sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [filteredRuns, state.sortKey, state.sortDir]);

  // Paginate — clamp page to valid range to avoid stale closure issues
  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / state.perPage));
  const clampedPage = Math.min(state.page, totalPages);
  const pageRuns = useMemo(() => {
    const start = (clampedPage - 1) * state.perPage;
    return sortedRuns.slice(start, start + state.perPage);
  }, [sortedRuns, clampedPage, state.perPage]);

  // Compute distinct remaining values for progressive narrowing
  const distinctRemaining = useMemo(() => {
    const result: Record<string, number[]> = {};
    // Only skip axes pinned to exact value, not range-filtered ones
    const exactPinnedKeys = new Set(
      state.filters
        .filter((f) => f.min !== undefined && f.max !== undefined && Math.abs(f.min - f.max) < 1e-9)
        .map((f) => f.key),
    );

    for (const axis of sweepAxes) {
      if (exactPinnedKeys.has(axis.key)) continue;
      const valueSet = new Set<number>();
      for (const run of filteredRuns) {
        const val = run.params[axis.key];
        if (val !== undefined) valueSet.add(val);
      }
      result[axis.key] = Array.from(valueSet).sort((a, b) => a - b);
    }
    return result;
  }, [filteredRuns, sweepAxes, state.filters]);

  // Actions — all immutable state updates
  const setFilter = useCallback((key: string, min?: number, max?: number) => {
    setState((prev) => {
      const others = prev.filters.filter((f) => f.key !== key);
      const hasValue = min !== undefined || max !== undefined;
      return {
        ...prev,
        filters: hasValue ? [...others, { key, min, max }] : others,
        page: 1,
      };
    });
  }, []);

  const clearFilter = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      filters: prev.filters.filter((f) => f.key !== key),
      page: 1,
    }));
  }, []);

  const clearAllFilters = useCallback(() => {
    setState((prev) => ({ ...prev, filters: [], page: 1 }));
  }, []);

  const setSort = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      sortKey: key,
      sortDir: prev.sortKey === key && prev.sortDir === "asc" ? "desc" : "asc",
      page: 1,
    }));
  }, []);

  const setPage = useCallback(
    (p: number) => {
      setState((prev) => ({
        ...prev,
        page: Math.max(1, Math.min(p, totalPages)),
      }));
    },
    [totalPages],
  );

  const setExactFilter = useCallback((key: string, value: number) => {
    setState((prev) => {
      const others = prev.filters.filter((f) => f.key !== key);
      return {
        ...prev,
        filters: [...others, { key, min: value, max: value }],
        page: 1,
      };
    });
  }, []);

  return {
    filteredRuns,
    totalFiltered: filteredRuns.length,
    pageRuns,
    totalPages,
    filters: state.filters,
    sortKey: state.sortKey,
    sortDir: state.sortDir,
    page: clampedPage,
    distinctRemaining,
    setFilter,
    clearFilter,
    clearAllFilters,
    setSort,
    setPage,
    setExactFilter,
  };
}
