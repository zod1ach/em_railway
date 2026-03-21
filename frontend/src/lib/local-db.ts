/**
 * Local project storage — backed by SQLite via the FastAPI backend.
 *
 * Projects persist on-disk regardless of which browser is used.
 * All operations go through /api/local-projects endpoints.
 */

const API_BASE = "/api/local-projects";

/* ── Types ── */

export interface LocalProject {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/** Cable parameters, WMM data, etc. stored per-project */
export interface ProjectData {
  project_id: string;
  hvac_params?: Record<string, unknown> | null;
  dc_params?: Record<string, unknown> | null;
  wmm_params?: Record<string, unknown> | null;
  cable_3d_params?: Record<string, unknown> | null;
  updated_at: string;
}

export interface ProjectExport {
  version: 1;
  project: LocalProject;
  data: ProjectData;
  exported_at: string;
}

/* ── HTTP helpers ── */

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

/* ── Project CRUD ── */

/** Create a new local project */
export async function createLocalProject(
  name: string,
  description: string
): Promise<LocalProject> {
  return api<LocalProject>("/", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  });
}

/** Get all local projects, newest first */
export async function getLocalProjects(): Promise<LocalProject[]> {
  return api<LocalProject[]>("/");
}

/** Get a single project by ID */
export async function getLocalProject(id: string): Promise<LocalProject | undefined> {
  try {
    return await api<LocalProject>(`/${id}`);
  } catch {
    return undefined;
  }
}

/** Update project metadata (name, description) */
export async function updateLocalProject(
  id: string,
  fields: Partial<Pick<LocalProject, "name" | "description">>
): Promise<LocalProject> {
  return api<LocalProject>(`/${id}`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

/** Delete a project and its data */
export async function deleteLocalProject(id: string): Promise<void> {
  await api<void>(`/${id}`, { method: "DELETE" });
}

/** Count of local projects */
export async function getLocalProjectCount(): Promise<number> {
  const res = await api<{ count: number }>("/count/total");
  return res.count;
}

/* ── Project Data CRUD ── */

/** Get project data (cable params, WMM, etc.) */
export async function getProjectData(projectId: string): Promise<ProjectData | undefined> {
  try {
    return await api<ProjectData>(`/${projectId}/data`);
  } catch {
    return undefined;
  }
}

/** Update project data (partial merge) */
export async function updateProjectData(
  projectId: string,
  fields: Partial<Omit<ProjectData, "project_id" | "updated_at">>
): Promise<ProjectData> {
  return api<ProjectData>(`/${projectId}/data`, {
    method: "PATCH",
    body: JSON.stringify(fields),
  });
}

/* ── Export / Import ── */

/** Export a project as a JSON-serializable object (for download) */
export async function exportProject(projectId: string): Promise<ProjectExport> {
  return api<ProjectExport>(`/${projectId}/export`);
}

/** Import a project from an exported JSON object */
export async function importProject(exported: ProjectExport): Promise<LocalProject> {
  const res = await api<{ id: string; name: string; created_at: string }>("/import", {
    method: "POST",
    body: JSON.stringify(exported),
  });
  return {
    id: res.id,
    name: res.name,
    description: exported.project.description,
    created_at: res.created_at,
    updated_at: res.created_at,
  };
}

/** Download a project as a .json file */
export async function downloadProject(projectId: string): Promise<void> {
  const exported = await exportProject(projectId);
  const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${exported.project.name.replace(/[^a-zA-Z0-9-_]/g, "_")}.electrofish.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Calculate approximate size of a project's data in bytes */
export async function getProjectSize(projectId: string): Promise<number> {
  const res = await api<{ size_bytes: number }>(`/${projectId}/size`);
  return res.size_bytes;
}
