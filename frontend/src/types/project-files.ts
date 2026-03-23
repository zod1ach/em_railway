export type FileCategory = "cable" | "wmm" | "bathymetry";
export type CableSubType = "hvac" | "dc_bipole";
export type WMMSubType = "grid" | "line";
export type FileSubType = CableSubType | WMMSubType;

export interface ProjectFile {
  id: string;
  project_id: string;
  category: FileCategory;
  sub_type?: FileSubType;
  name: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  /* Batch mode fields (nullable — only set for batch-generated files) */
  batch_folder_id?: string;
  batch_run_number?: number;
  calc_peak_b_field?: number;
  calc_peak_e_field?: number;
  calc_status?: CalcStatus;
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  cable: "Cable Model",
  wmm: "WMM Geomagnetic",
  bathymetry: "Bathymetry",
};

export const CABLE_SUB_TYPE_LABELS: Record<CableSubType, string> = {
  hvac: "HVAC",
  dc_bipole: "DC Bipole",
};

export const TEAM_FILE_LIMIT = 4;

/* ── Batch Mode Types ── */

export type BatchMode = "magnetic" | "non_magnetic" | "cable" | "location";
export type CalcStatus = "pending" | "running" | "completed" | "error";
export type BatchStatus = "created" | "generating" | "ready" | "error";

export interface SweepParameter {
  key: string;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number | null;
  values: number[];
}

export interface SweepConfig {
  parameters: SweepParameter[];
}

export interface LocationConfig {
  waypoints: { lat: number; lng: number }[];
  total_points: number;
  interpolation: "linear" | "great_circle";
}

export interface BatchFolder {
  id: string;
  project_id: string;
  parent_file_id: string;
  name: string;
  tag: string;
  cable_model_type: CableSubType;
  batch_mode: BatchMode;
  base_params: Record<string, string>;
  sweep_config: SweepConfig;
  location_config?: LocationConfig;
  total_runs: number;
  estimated_size_bytes: number;
  status: BatchStatus;
  created_at: string;
}

export interface BatchRun {
  file_id: string;
  run_number: number;
  tag_path: string;
  params: Record<string, number>;
  calc_peak_b_field?: number;
  calc_peak_e_field?: number;
  calc_status: CalcStatus;
}

/* ── Discriminated union for tree node data ── */

export type TreeNodeData =
  | { kind: "file"; file: ProjectFile }
  | { kind: "batch-folder"; folder: BatchFolder; parentFile: ProjectFile }
  | { kind: "batch-file"; file: ProjectFile };
