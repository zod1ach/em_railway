/**
 * Local IndexedDB storage for offline personal projects.
 *
 * Database: "electrofish"
 * Stores:
 *   - "projects"     → project metadata (id, name, description, timestamps)
 *   - "project_data" → per-project cable parameters, WMM data, etc.
 *
 * All operations are async and return typed results.
 * No external dependencies — uses the native IndexedDB API.
 */

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
  /** HVAC cable parameters (shared by magnetic & non-magnetic) */
  hvac_params?: Record<string, unknown>;
  /** DC bipole parameters */
  dc_params?: Record<string, unknown>;
  /** WMM geomagnetic model data */
  wmm_params?: Record<string, unknown>;
  /** Cable 3D route data (local-only, never synced) */
  cable_3d_params?: Record<string, unknown>;
  updated_at: string;
}

/* ── Constants ── */

const DB_NAME = "electrofish";
const DB_VERSION = 1;
const STORE_PROJECTS = "projects";
const STORE_PROJECT_DATA = "project_data";

/* ── Database connection ── */

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_PROJECTS)) {
        const store = db.createObjectStore(STORE_PROJECTS, { keyPath: "id" });
        store.createIndex("created_at", "created_at", { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_PROJECT_DATA)) {
        db.createObjectStore(STORE_PROJECT_DATA, { keyPath: "project_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

/** Helper: wrap an IDBRequest in a Promise */
function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Helper: wrap an IDBTransaction completion in a Promise */
function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/* ── Project CRUD ── */

/** Generate a UUID v4 (crypto API, no dependencies) */
function uuid(): string {
  return crypto.randomUUID();
}

/** Create a new local project */
export async function createLocalProject(
  name: string,
  description: string
): Promise<LocalProject> {
  const db = await openDB();
  const now = new Date().toISOString();

  const project: LocalProject = {
    id: uuid(),
    name,
    description: description || null,
    created_at: now,
    updated_at: now,
  };

  const tx = db.transaction([STORE_PROJECTS, STORE_PROJECT_DATA], "readwrite");
  tx.objectStore(STORE_PROJECTS).put(project);

  // Initialize empty project data
  const data: ProjectData = {
    project_id: project.id,
    updated_at: now,
  };
  tx.objectStore(STORE_PROJECT_DATA).put(data);

  await txDone(tx);
  return project;
}

/** Get all local projects, newest first */
export async function getLocalProjects(): Promise<LocalProject[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  const store = tx.objectStore(STORE_PROJECTS);
  const all = await reqToPromise(store.getAll());

  // Sort newest first
  return all.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

/** Get a single project by ID */
export async function getLocalProject(id: string): Promise<LocalProject | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  return reqToPromise(tx.objectStore(STORE_PROJECTS).get(id));
}

/** Update project metadata (name, description) */
export async function updateLocalProject(
  id: string,
  fields: Partial<Pick<LocalProject, "name" | "description">>
): Promise<LocalProject> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readwrite");
  const store = tx.objectStore(STORE_PROJECTS);

  const existing = await reqToPromise(store.get(id));
  if (!existing) throw new Error(`Project ${id} not found`);

  const updated: LocalProject = {
    ...existing,
    ...fields,
    updated_at: new Date().toISOString(),
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

/** Delete a project and its data */
export async function deleteLocalProject(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction([STORE_PROJECTS, STORE_PROJECT_DATA], "readwrite");
  tx.objectStore(STORE_PROJECTS).delete(id);
  tx.objectStore(STORE_PROJECT_DATA).delete(id);
  await txDone(tx);
}

/** Count of local projects */
export async function getLocalProjectCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECTS, "readonly");
  return reqToPromise(tx.objectStore(STORE_PROJECTS).count());
}

/* ── Project Data CRUD ── */

/** Get project data (cable params, WMM, etc.) */
export async function getProjectData(projectId: string): Promise<ProjectData | undefined> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECT_DATA, "readonly");
  return reqToPromise(tx.objectStore(STORE_PROJECT_DATA).get(projectId));
}

/** Update project data (partial merge) */
export async function updateProjectData(
  projectId: string,
  fields: Partial<Omit<ProjectData, "project_id" | "updated_at">>
): Promise<ProjectData> {
  const db = await openDB();
  const tx = db.transaction(STORE_PROJECT_DATA, "readwrite");
  const store = tx.objectStore(STORE_PROJECT_DATA);

  const existing = await reqToPromise(store.get(projectId));
  const updated: ProjectData = {
    project_id: projectId,
    ...existing,
    ...fields,
    updated_at: new Date().toISOString(),
  };
  store.put(updated);
  await txDone(tx);
  return updated;
}

/* ── Export / Import ── */

export interface ProjectExport {
  version: 1;
  project: LocalProject;
  data: ProjectData;
  exported_at: string;
}

/** Export a project as a JSON-serializable object (for download) */
export async function exportProject(projectId: string): Promise<ProjectExport> {
  const project = await getLocalProject(projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);

  const data = await getProjectData(projectId);
  if (!data) throw new Error(`Project data for ${projectId} not found`);

  return {
    version: 1,
    project,
    data,
    exported_at: new Date().toISOString(),
  };
}

/** Import a project from an exported JSON object */
export async function importProject(exported: ProjectExport): Promise<LocalProject> {
  if (exported.version !== 1) throw new Error("Unsupported export version");

  const db = await openDB();
  const now = new Date().toISOString();

  // Generate a new ID to avoid collisions
  const newId = uuid();
  const project: LocalProject = {
    ...exported.project,
    id: newId,
    updated_at: now,
  };
  const data: ProjectData = {
    ...exported.data,
    project_id: newId,
    updated_at: now,
  };

  const tx = db.transaction([STORE_PROJECTS, STORE_PROJECT_DATA], "readwrite");
  tx.objectStore(STORE_PROJECTS).put(project);
  tx.objectStore(STORE_PROJECT_DATA).put(data);
  await txDone(tx);

  return project;
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
  const data = await getProjectData(projectId);
  if (!data) return 0;
  return new Blob([JSON.stringify(data)]).size;
}
