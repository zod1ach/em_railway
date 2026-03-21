export type FileCategory = "cable" | "wmm" | "bathymetry";
export type CableSubType = "hvac" | "dc_bipole";

export interface ProjectFile {
  id: string;
  project_id: string;
  category: FileCategory;
  sub_type?: CableSubType;
  name: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
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
