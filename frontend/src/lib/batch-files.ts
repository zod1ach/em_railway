/**
 * Batch mode API client functions.
 * Mirrors the backend batch_files.py endpoints.
 */

import type {
  BatchFolder,
  BatchRun,
  SweepParameter,
  LocationConfig,
  BatchMode,
  CableSubType,
} from "@/types/project-files";

const API_BASE = "/api/local-projects";

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (res.status === 204) return undefined as unknown as T;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }
  return res.json();
}

/* ── Batch Folder CRUD ── */

export interface CreateBatchInput {
  name: string;
  tag: string;
  parent_file_id: string;
  cable_model_type: CableSubType;
  batch_mode: BatchMode;
  sweep_parameters: SweepParameter[];
  location_config?: LocationConfig;
}

export async function createBatch(
  projectId: string,
  input: CreateBatchInput,
): Promise<BatchFolder> {
  return api<BatchFolder>(`/${projectId}/batches`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getBatches(projectId: string): Promise<BatchFolder[]> {
  return api<BatchFolder[]>(`/${projectId}/batches`);
}

export async function getBatch(
  projectId: string,
  batchId: string,
): Promise<BatchFolder & { sweep_axes: unknown[] }> {
  return api(`/${projectId}/batches/${batchId}`);
}

export async function deleteBatch(
  projectId: string,
  batchId: string,
): Promise<void> {
  return api<void>(`/${projectId}/batches/${batchId}`, { method: "DELETE" });
}

/* ── Batch Run Queries ── */

export interface BatchRunsResponse {
  runs: BatchRun[];
  total: number;
  page: number;
  per_page: number;
}

export async function getBatchRuns(
  projectId: string,
  batchId: string,
  page = 1,
  perPage = 50,
  sort = "batch_run_number",
  order = "asc",
): Promise<BatchRunsResponse> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
    sort,
    order,
  });
  return api(`/${projectId}/batches/${batchId}/runs?${params}`);
}

export interface FilterInput {
  key: string;
  min?: number;
  max?: number;
  exact?: number;
}

export interface FilterResponse {
  runs: BatchRun[];
  total: number;
  page: number;
  per_page: number;
  distinct_remaining: Record<string, number[]>;
}

export async function filterBatchRuns(
  projectId: string,
  batchId: string,
  filters: FilterInput[],
  page = 1,
  perPage = 50,
): Promise<FilterResponse> {
  return api(`/${projectId}/batches/${batchId}/runs/filter`, {
    method: "POST",
    body: JSON.stringify({ filters, page, per_page: perPage }),
  });
}

/* ── Batch Run Selection (for flow loading) ── */

export interface SelectResponse {
  tag_paths: string[];
  count: number;
}

export async function selectBatchRuns(
  projectId: string,
  batchId: string,
  fileIds: string[],
): Promise<SelectResponse> {
  return api(`/${projectId}/batches/${batchId}/runs/select`, {
    method: "POST",
    body: JSON.stringify({ file_ids: fileIds }),
  });
}

/* ── Tag Validation ── */

export async function checkTagUnique(
  projectId: string,
  tag: string,
): Promise<boolean> {
  try {
    const batches = await getBatches(projectId);
    return !batches.some((b) => b.tag === tag);
  } catch {
    return true;
  }
}
