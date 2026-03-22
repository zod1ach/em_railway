import type { ProjectFile, FileCategory, FileSubType } from "@/types/project-files";
import { supabase } from "./supabase";

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

// Local (SQLite via FastAPI)

export async function getLocalFiles(projectId: string): Promise<ProjectFile[]> {
  return api<ProjectFile[]>(`/${projectId}/files`);
}

export async function createLocalFile(
  projectId: string,
  category: FileCategory,
  subType?: FileSubType
): Promise<ProjectFile> {
  return api<ProjectFile>(`/${projectId}/files`, {
    method: "POST",
    body: JSON.stringify({ category, sub_type: subType ?? null }),
  });
}

export async function deleteLocalFile(
  projectId: string,
  fileId: string
): Promise<void> {
  return api<void>(`/${projectId}/files/${fileId}`, { method: "DELETE" });
}

export async function getLocalFileData(
  projectId: string,
  fileId: string
): Promise<Record<string, any>> {
  return api<Record<string, any>>(`/${projectId}/files/${fileId}/data`);
}

export async function saveLocalFileData(
  projectId: string,
  fileId: string,
  data: { name?: string; tag?: string; magnetic?: boolean; params?: Record<string, string> }
): Promise<Record<string, any>> {
  return api<Record<string, any>>(`/${projectId}/files/${fileId}/data`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Team (Supabase)

export async function getTeamFiles(projectId: string): Promise<ProjectFile[]> {
  const { data, error } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as ProjectFile[];
}

export async function createTeamFile(
  projectId: string,
  category: FileCategory,
  subType?: FileSubType
): Promise<ProjectFile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let query = supabase
    .from("project_files")
    .select("name")
    .eq("project_id", projectId)
    .eq("category", category);

  if (subType) {
    query = query.eq("sub_type", subType);
  }

  const { data: names } = await query;

  let maxNum = 0;
  for (const row of names ?? []) {
    const match = row.name.match(/#(\d+)$/);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }

  let prefix: string;
  if (category === "cable") {
    prefix = subType === "dc_bipole" ? "Cable DC Bipole" : "Cable HVAC";
  } else if (category === "wmm") {
    prefix = subType === "line" ? "WMM Line" : "WMM Grid";
  } else {
    prefix = "Bathymetry";
  }

  const name = `${prefix} #${maxNum + 1}`;

  const { data, error } = await supabase
    .from("project_files")
    .insert({
      project_id: projectId,
      category,
      sub_type: subType ?? null,
      name,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as ProjectFile;
}

export async function deleteTeamFile(
  projectId: string,
  fileId: string
): Promise<void> {
  const { error } = await supabase
    .from("project_files")
    .delete()
    .eq("id", fileId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
}

export async function getTeamFileData(
  projectId: string,
  fileId: string
): Promise<Record<string, any>> {
  const { data, error } = await supabase
    .from("project_files")
    .select("file_data")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .single();

  if (error) throw new Error(error.message);
  return (data?.file_data ?? {}) as Record<string, any>;
}

export async function saveTeamFileData(
  projectId: string,
  fileId: string,
  fileData: { name?: string; tag?: string; magnetic?: boolean; params?: Record<string, string> }
): Promise<Record<string, any>> {
  // Read existing file_data, merge, and update
  const { data: existing, error: readErr } = await supabase
    .from("project_files")
    .select("file_data")
    .eq("id", fileId)
    .eq("project_id", projectId)
    .single();

  if (readErr) throw new Error(readErr.message);

  const merged = { ...(existing?.file_data ?? {}), ...fileData };
  if (fileData.params) merged.params = fileData.params;

  const updates: Record<string, any> = {
    file_data: merged,
    updated_at: new Date().toISOString(),
  };
  if (fileData.name) updates.name = fileData.name;

  const { data, error } = await supabase
    .from("project_files")
    .update(updates)
    .eq("id", fileId)
    .eq("project_id", projectId)
    .select("file_data")
    .single();

  if (error) throw new Error(error.message);
  return (data?.file_data ?? {}) as Record<string, any>;
}
