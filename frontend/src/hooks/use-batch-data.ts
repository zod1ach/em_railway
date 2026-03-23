/**
 * Hook to load batch folder metadata and all runs from API.
 * Loads all runs client-side (max 500) for instant filtering.
 */

import { useState, useEffect, useCallback } from "react";
import { getBatch, getBatchRuns, type BatchRunsResponse } from "@/lib/batch-files";
import type { BatchFolder, BatchRun, SweepParameter } from "@/types/project-files";

interface BatchData {
  batch: BatchFolder | null;
  sweepAxes: SweepParameter[];
  allRuns: BatchRun[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useBatchData(projectId: string, batchId: string): BatchData {
  const [batch, setBatch] = useState<BatchFolder | null>(null);
  const [sweepAxes, setSweepAxes] = useState<SweepParameter[]>([]);
  const [allRuns, setAllRuns] = useState<BatchRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const batchData = await getBatch(projectId, batchId);
      setBatch(batchData);
      // Map API sweep_axes (param_key, min_val, etc.) to SweepParameter shape (key, min, etc.)
      const rawAxes = (batchData as any).sweep_axes ?? [];
      const mappedAxes: SweepParameter[] = rawAxes.length > 0
        ? rawAxes.map((a: any) => ({
            key: a.param_key ?? a.key,
            label: a.param_label ?? a.label ?? a.param_key ?? a.key,
            unit: a.unit ?? "",
            min: a.min_val ?? a.min ?? 0,
            max: a.max_val ?? a.max ?? 0,
            step: a.step_val ?? a.step ?? null,
            values: typeof a.values_json === "string" ? JSON.parse(a.values_json) : (a.values ?? []),
          }))
        : (batchData.sweep_config?.parameters ?? []);
      setSweepAxes(mappedAxes);

      // Load ALL runs client-side (max 500 — well within client capacity)
      // Hard cap at 10 pages (10 × 100 = 1000) to prevent infinite loops
      const MAX_PAGES = 10;
      const allPages: BatchRun[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= MAX_PAGES) {
        const resp: BatchRunsResponse = await getBatchRuns(
          projectId,
          batchId,
          page,
          100,
        );
        allPages.push(...resp.runs);
        hasMore = allPages.length < resp.total;
        page++;
      }
      setAllRuns(allPages);
    } catch (err: any) {
      setError(err.message ?? "Failed to load batch data");
    } finally {
      setLoading(false);
    }
  }, [projectId, batchId]);

  useEffect(() => {
    load();
  }, [load]);

  return { batch, sweepAxes, allRuns, loading, error, reload: load };
}
