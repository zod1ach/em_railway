# Project Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Project Workspace page — the hub users see when clicking a project card, showing categorised model files (Cable HVAC/DC, WMM, Bathymetry) with creation, deletion, and navigation into the calculator dashboard.

**Architecture:** New `ProjectWorkspace` component sits between the projects grid and the existing dashboard. It renders 3 collapsible accordion sections (Cable Model, WMM Geomagnetic, Bathymetry) with file cards in a 3-column grid. A day-picker-style pill button handles file creation with a smooth-dropdown sub-selector for Cable sub-types. Navigation uses breadcrumbs. Storage is dual: FastAPI/SQLite for personal projects, Supabase for team projects.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, motion/react, lucide-react, boring-avatars, FastAPI, SQLite, Supabase

**Spec:** `docs/superpowers/specs/2026-03-21-project-workspace-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/types/project-files.ts` | `ProjectFile` type + category/sub-type constants |
| `frontend/src/lib/project-files.ts` | CRUD functions for both storage backends (SQLite API calls + Supabase queries) |
| `frontend/src/components/ui/file-creator-pill.tsx` | + button adapted from day-picker pattern with cable sub-type selector |
| `frontend/src/components/ui/project-workspace.tsx` | Main workspace page with category sections, file cards, toolbar |
| `frontend/src/components/ui/breadcrumbs.tsx` | Breadcrumb navigation component |
| `backend/api/project_files.py` | FastAPI router for local project file CRUD |
| `supabase/migrations/20260321_project_files.sql` | Supabase table + RLS + trigger for team files |

### Modified Files

| File | Changes |
|------|---------|
| `backend/main.py` (line 37) | Register new `project_files_router` |
| `frontend/src/App.tsx` (lines 26, 48-60, 298-301, 426-469) | Add "workspace" view, new state vars, workspace render, breadcrumbs in dashboard |
| `frontend/src/components/OfflineApp.tsx` (lines 25, 81-83, 325-381) | Add "workspace" to OfflineView, workspace render, breadcrumbs |
| `frontend/src/components/ui/projects-collection.tsx` (line 53) | Change `onSelectProject` to pass `(projectId, projectType, projectName)` |

---

## Task 1: ProjectFile Type Definition

**Files:**
- Create: `frontend/src/types/project-files.ts`

- [ ] **Step 1: Create the type file**

```typescript
// frontend/src/types/project-files.ts

export type FileCategory = "cable" | "wmm" | "bathymetry";
export type CableSubType = "hvac" | "dc_bipole";

export interface ProjectFile {
  id: string;
  project_id: string;
  category: FileCategory;
  sub_type?: CableSubType;
  name: string;
  created_by?: string;  // UUID, only populated for team files
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `project-files.ts`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/project-files.ts
git commit -m "feat: add ProjectFile type definitions"
```

---

## Task 2: FastAPI Backend — Project Files Router

**Files:**
- Create: `backend/api/project_files.py`
- Modify: `backend/main.py` (line 37, add router import + registration)

- [ ] **Step 1: Create the project_files router**

Create `backend/api/project_files.py`. Follow the exact pattern from `backend/api/local_projects.py`:
- Use the same `get_db()` context manager from `local_projects.py`
- Same router pattern with `APIRouter()`
- Same error handling with `HTTPException`

```python
# backend/api/project_files.py
"""
CRUD endpoints for project files (model file metadata).
Files belong to a local project and represent Cable (HVAC/DC), WMM, or Bathymetry models.
"""

import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from .local_projects import get_db  # reuse the same DB connection helper

router = APIRouter()

# ── Models ──

class FileCreate(BaseModel):
    category: str  # "cable" | "wmm" | "bathymetry"
    sub_type: Optional[str] = None  # "hvac" | "dc_bipole" (only for cable)

class FileOut(BaseModel):
    id: str
    project_id: str
    category: str
    sub_type: Optional[str]
    name: str
    created_at: str
    updated_at: str

# ── Table init ──

def init_project_files_table():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS project_files (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                category TEXT NOT NULL CHECK (category IN ('cable', 'wmm', 'bathymetry')),
                sub_type TEXT CHECK (
                    (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
                    OR (category != 'cable' AND sub_type IS NULL)
                ),
                name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)

init_project_files_table()

# ── Helpers ──

def _generate_name(conn: sqlite3.Connection, project_id: str, category: str, sub_type: Optional[str]) -> str:
    """Generate auto-incremented file name based on MAX existing suffix."""
    # Determine prefix first
    if category == "cable" and sub_type == "dc_bipole":
        prefix = "Cable DC Bipole"
    elif category == "cable" and sub_type == "hvac":
        prefix = "Cable HVAC"
    elif category == "wmm":
        prefix = "WMM"
    else:
        prefix = "Bathymetry"

    # Query existing names for this type
    if category == "cable" and sub_type:
        rows = conn.execute(
            "SELECT name FROM project_files WHERE project_id = ? AND category = ? AND sub_type = ?",
            (project_id, category, sub_type),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT name FROM project_files WHERE project_id = ? AND category = ?",
            (project_id, category),
        ).fetchall()

    # Find max number suffix
    max_num = 0
    for r in rows:
        name = r["name"] if isinstance(r, sqlite3.Row) else r[0]
        if "#" in name:
            try:
                num = int(name.rsplit("#", 1)[1].strip())
                max_num = max(max_num, num)
            except ValueError:
                pass

    return f"{prefix} #{max_num + 1}"

def _row_to_dict(row) -> dict:
    return dict(row) if row else None

# ── Routes ──

@router.get("/{project_id}/files", response_model=list[FileOut])
def list_files(project_id: str):
    with get_db() as conn:
        # Verify project exists
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(404, "Project not found")
        rows = conn.execute(
            "SELECT * FROM project_files WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]

@router.post("/{project_id}/files", response_model=FileOut, status_code=201)
def create_file(project_id: str, body: FileCreate):
    # Validate category
    if body.category not in ("cable", "wmm", "bathymetry"):
        raise HTTPException(400, "Invalid category")
    if body.category == "cable" and body.sub_type not in ("hvac", "dc_bipole"):
        raise HTTPException(400, "Cable category requires sub_type: hvac or dc_bipole")
    if body.category != "cable" and body.sub_type is not None:
        raise HTTPException(400, "sub_type only valid for cable category")

    with get_db() as conn:
        # Verify project exists
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(404, "Project not found")

        name = _generate_name(conn, project_id, body.category, body.sub_type)
        file_id = conn.execute("SELECT lower(hex(randomblob(16)))").fetchone()[0]
        conn.execute(
            """INSERT INTO project_files (id, project_id, category, sub_type, name)
               VALUES (?, ?, ?, ?, ?)""",
            (file_id, project_id, body.category, body.sub_type, name),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM project_files WHERE id = ?", (file_id,)).fetchone()
        return _row_to_dict(row)

@router.delete("/{project_id}/files/{file_id}", status_code=204)
def delete_file(project_id: str, file_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM project_files WHERE id = ? AND project_id = ?",
            (file_id, project_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        conn.execute("DELETE FROM project_files WHERE id = ?", (file_id,))
        conn.commit()
```

- [ ] **Step 2: Register the router in main.py**

In `backend/main.py`, add import (after line 13) and registration (after line 37):

```python
# Add to imports:
from api.project_files import router as project_files_router

# Add to router registrations:
app.include_router(project_files_router, prefix="/api/local-projects", tags=["project-files"])
```

Note: We mount on the same `/api/local-projects` prefix since routes are `/{project_id}/files/...` — they don't conflict with existing routes.

- [ ] **Step 3: Test the backend manually**

Run the backend server and test with curl:

```bash
cd backend && python -m uvicorn main:app --reload --port 8000 &

# Create a test project first
curl -s -X POST http://localhost:8000/api/local-projects/ \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","description":"test"}' | python -m json.tool

# Note the project ID from the response, then:
# List files (should be empty)
curl -s http://localhost:8000/api/local-projects/{PROJECT_ID}/files | python -m json.tool

# Create a Cable HVAC file
curl -s -X POST http://localhost:8000/api/local-projects/{PROJECT_ID}/files \
  -H 'Content-Type: application/json' \
  -d '{"category":"cable","sub_type":"hvac"}' | python -m json.tool
# Expected: 201 with name "Cable HVAC #1"

# Create a WMM file
curl -s -X POST http://localhost:8000/api/local-projects/{PROJECT_ID}/files \
  -H 'Content-Type: application/json' \
  -d '{"category":"wmm"}' | python -m json.tool
# Expected: 201 with name "WMM #1"

# List files (should have 2)
curl -s http://localhost:8000/api/local-projects/{PROJECT_ID}/files | python -m json.tool

# Delete the first file
curl -s -X DELETE http://localhost:8000/api/local-projects/{PROJECT_ID}/files/{FILE_ID}
# Expected: 204

# Create another Cable HVAC (should be #2, not #1 — max-based naming)
curl -s -X POST http://localhost:8000/api/local-projects/{PROJECT_ID}/files \
  -H 'Content-Type: application/json' \
  -d '{"category":"cable","sub_type":"hvac"}' | python -m json.tool
# Expected: 201 with name "Cable HVAC #2"
```

- [ ] **Step 4: Commit**

```bash
git add backend/api/project_files.py backend/main.py
git commit -m "feat: add FastAPI project files endpoints"
```

---

## Task 3: Frontend Lib — project-files.ts

**Files:**
- Create: `frontend/src/lib/project-files.ts`

- [ ] **Step 1: Create the lib file**

Follow the same patterns as `frontend/src/lib/local-db.ts` for local calls and `frontend/src/lib/projects.ts` for Supabase calls.

```typescript
// frontend/src/lib/project-files.ts
import type { ProjectFile, FileCategory, CableSubType } from "@/types/project-files";
import { supabase } from "./supabase";

const API_BASE = "/api/local-projects";

// ── HTTP helper (same pattern as local-db.ts) ──

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

// ── Local (SQLite via FastAPI) ──

export async function getLocalFiles(projectId: string): Promise<ProjectFile[]> {
  return api<ProjectFile[]>(`/${projectId}/files`);
}

export async function createLocalFile(
  projectId: string,
  category: FileCategory,
  subType?: CableSubType
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

// ── Team (Supabase) ──

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
  subType?: CableSubType
): Promise<ProjectFile> {
  // Server-side trigger enforces 4-file limit.
  // Name generation is client-side for Supabase (no stored proc available).
  // This is acceptable since team projects have max 4 files — race conditions are unlikely.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Query existing names for this type to find max suffix
  let query = supabase
    .from("project_files")
    .select("name")
    .eq("project_id", projectId)
    .eq("category", category);

  if (category === "cable" && subType) {
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
    prefix = "WMM";
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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/project-files.ts
git commit -m "feat: add project files CRUD lib for local + team"
```

---

## Task 4: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260321_project_files.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260321_project_files.sql
-- Project files: model file metadata for team projects

CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('cable', 'wmm', 'bathymetry')),
  sub_type TEXT CHECK (
    (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
    OR (category != 'cable' AND sub_type IS NULL)
  ),
  name TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups by project
CREATE INDEX idx_project_files_project_id ON project_files(project_id);

-- 4-file limit trigger
CREATE OR REPLACE FUNCTION enforce_team_file_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM project_files WHERE project_id = NEW.project_id) >= 4 THEN
    RAISE EXCEPTION 'Team project file limit (4) exceeded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_file_limit
  BEFORE INSERT ON project_files
  FOR EACH ROW EXECUTE FUNCTION enforce_team_file_limit();

-- RLS policies
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;

-- SELECT: any project member can read files
CREATE POLICY "Members can view project files"
  ON project_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_files.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.status = 'accepted'
    )
  );

-- INSERT: only Owner/Editor can create files
CREATE POLICY "Owners and editors can create files"
  ON project_files FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_files.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('Owner', 'Editor')
        AND project_members.status = 'accepted'
    )
  );

-- DELETE: only Owner/Editor can delete files
CREATE POLICY "Owners and editors can delete files"
  ON project_files FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_members.project_id = project_files.project_id
        AND project_members.user_id = auth.uid()
        AND project_members.role IN ('Owner', 'Editor')
        AND project_members.status = 'accepted'
    )
  );
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260321_project_files.sql
git commit -m "feat: add Supabase project_files table migration"
```

---

## Task 5: Breadcrumbs Component

**Files:**
- Create: `frontend/src/components/ui/breadcrumbs.tsx`

- [ ] **Step 1: Create the breadcrumbs component**

```tsx
// frontend/src/components/ui/breadcrumbs.tsx
import { ChevronRight } from "lucide-react";

interface BreadcrumbItem {
  label: string;
  onClick?: () => void; // undefined = non-clickable (current location)
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3 text-[#555]" />}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              data-magnetic
              className="text-[#888] hover:text-white transition-colors cursor-none"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-white">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/breadcrumbs.tsx
git commit -m "feat: add breadcrumbs navigation component"
```

---

## Task 6: FileCreatorPill Component (+ Button)

**Files:**
- Create: `frontend/src/components/ui/file-creator-pill.tsx`

- [ ] **Step 1: Create the file creator pill**

Adapt from the day-picker component (0xUrvish/day-picker). Replace `@hugeicons` with `lucide-react`. Replace `framer-motion` with `motion/react`. The component has 3 states:
1. Collapsed: shows "New File" pill
2. Expanded: shows Cable Model / WMM / Bathymetry options
3. Cable sub-type: shows HVAC / DC Bipole options (smooth-dropdown style)

```tsx
// frontend/src/components/ui/file-creator-pill.tsx
import { useState } from "react";
import { Plus, Check, ChevronsUpDown, Cable, Globe, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import type { FileCategory, CableSubType } from "@/types/project-files";

const springTransition = {
  type: "spring",
  damping: 30,
  stiffness: 400,
  mass: 1,
} as const;

type CategoryOption = {
  id: FileCategory;
  label: string;
  icon: typeof Cable;
};

const categories: CategoryOption[] = [
  { id: "cable", label: "Cable Model", icon: Cable },
  { id: "wmm", label: "WMM Geomagnetic", icon: Globe },
  { id: "bathymetry", label: "Bathymetry", icon: Waves },
];

type SubTypeOption = {
  id: CableSubType;
  label: string;
};

const cableSubTypes: SubTypeOption[] = [
  { id: "hvac", label: "HVAC" },
  { id: "dc_bipole", label: "DC Bipole" },
];

interface FileCreatorPillProps {
  onCreateFile: (category: FileCategory, subType?: CableSubType) => Promise<void>;
  disabled?: boolean;
  fileCount?: number;
  fileLimit?: number;
}

export function FileCreatorPill({
  onCreateFile,
  disabled = false,
  fileCount,
  fileLimit,
}: FileCreatorPillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>("cable");
  const [selectedSubType, setSelectedSubType] = useState<CableSubType>("hvac");
  const [showSubType, setShowSubType] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCategorySelect = (category: FileCategory) => {
    setSelectedCategory(category);
    if (category === "cable") {
      setShowSubType(true);
    } else {
      setShowSubType(false);
    }
  };

  const handleConfirm = async () => {
    setCreating(true);
    try {
      if (selectedCategory === "cable") {
        await onCreateFile(selectedCategory, selectedSubType);
      } else {
        await onCreateFile(selectedCategory);
      }
      setIsOpen(false);
      setShowSubType(false);
    } catch {
      // Error handled by parent (toast)
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setShowSubType(false);
  };

  const atLimit = fileLimit !== undefined && fileCount !== undefined && fileCount >= fileLimit;

  return (
    <div className="flex items-center gap-3">
      <motion.div
        layout
        transition={springTransition}
        className={cn(
          "flex flex-col gap-1.5 overflow-hidden rounded-3xl bg-[#1c1c1c] p-1.5",
          disabled || atLimit ? "opacity-40 pointer-events-none" : ""
        )}
      >
        {/* Header row */}
        <div className="flex justify-between items-center relative">
          {/* Label (blurs when open) */}
          <motion.div
            layout
            animate={{
              filter: isOpen ? "blur(8px)" : "blur(0px)",
            }}
            transition={springTransition}
            className="px-3 text-[#888] h-full flex items-center justify-center py-2"
          >
            New File
          </motion.div>

          {isOpen ? (
            /* Expanded: category options */
            <div className="absolute w-full h-full flex justify-between gap-2 p-0">
              <motion.div className="flex justify-between w-full relative items-center rounded-3xl">
                <motion.div
                  layout
                  transition={springTransition}
                  layoutId="pill-options-bg"
                  className="absolute w-full rounded-3xl bg-[#0d0d0d] h-full"
                />
                <div className="flex justify-between px-1">
                  {categories.map((cat) => (
                    <motion.div
                      key={cat.id}
                      layout
                      initial={{ filter: "blur(8px)", opacity: 0 }}
                      animate={{ filter: "blur(0px)", opacity: 1 }}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-3xl relative transition-colors duration-300 cursor-none flex items-center gap-1.5",
                        selectedCategory === cat.id ? "text-white" : "text-[#888]"
                      )}
                      data-magnetic
                    >
                      {selectedCategory === cat.id && (
                        <motion.div
                          layoutId="pill-active-option"
                          transition={springTransition}
                          className="w-full h-full absolute inset-0 bg-[#222] rounded-3xl"
                        />
                      )}
                      <cat.icon className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10 text-xs whitespace-nowrap">{cat.label}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Confirm button */}
              <AnimatePresence>
                <motion.div
                  key="confirm-btn"
                  layoutId="pill-action-btn"
                  onClick={creating ? undefined : handleConfirm}
                  initial={{ filter: "blur(1px)", opacity: 0.6 }}
                  animate={{ filter: "blur(0px)", opacity: 1 }}
                  exit={{ filter: "blur(1px)", opacity: 0.6 }}
                  transition={springTransition}
                  style={{ borderRadius: 24 }}
                  className="bg-[#CCFF00] px-[10px] justify-center text-black flex h-full items-center cursor-none"
                  data-magnetic
                >
                  {creating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                    />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            /* Collapsed: pill button */
            <motion.div
              onClick={disabled || atLimit ? undefined : () => setIsOpen(true)}
              className="rounded-full w-fit px-0 p-0 relative flex gap-0 items-center cursor-none"
              data-magnetic
            >
              <motion.div
                layout
                transition={springTransition}
                layoutId="pill-options-bg"
                className="absolute h-full w-full bg-[#0d0d0d] rounded-3xl"
              />
              <motion.div
                initial={false}
                className="pl-3 py-0 relative text-white flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
              </motion.div>
              <AnimatePresence initial={false}>
                <motion.div
                  key="expand-icon"
                  layoutId="pill-action-btn"
                  className="text-[#888] justify-center flex items-center w-fit h-fit px-3 pl-2 py-[10px]"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 -rotate-90" />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        {/* Cable sub-type selector row */}
        <AnimatePresence mode="popLayout">
          {isOpen && showSubType && selectedCategory === "cable" && (
            <motion.div
              initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              transition={springTransition}
              className="flex text-[#888] px-2 bg-[#0d0d0d] overflow-hidden rounded-full py-1 gap-1"
            >
              {cableSubTypes.map((st, index) => (
                <motion.div
                  key={st.id}
                  layout
                  initial={{ filter: "blur(8px)", opacity: 0 }}
                  animate={{ filter: "blur(0px)", opacity: 1 }}
                  exit={{ filter: "blur(8px)", opacity: 0 }}
                  transition={{ ...springTransition, delay: index * 0.03 }}
                  onClick={() => setSelectedSubType(st.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-3xl relative transition-colors duration-300 cursor-none text-xs",
                    selectedSubType === st.id ? "text-white" : "text-[#888]"
                  )}
                  data-magnetic
                >
                  <span className="relative z-10">{st.label}</span>
                  {selectedSubType === st.id && (
                    <motion.div
                      transition={springTransition}
                      layoutId="pill-subtype-active"
                      className="absolute h-full w-full bg-[#222] inset-0 rounded-3xl"
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* File count badge (team mode) */}
      {fileLimit !== undefined && fileCount !== undefined && (
        <span className="text-xs text-[#888]">
          <span className={cn(atLimit ? "text-error" : "text-white")}>{fileCount}</span>
          {" / "}
          {fileLimit} files
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/file-creator-pill.tsx
git commit -m "feat: add FileCreatorPill component (day-picker style)"
```

---

## Task 7: ProjectWorkspace Component

**Files:**
- Create: `frontend/src/components/ui/project-workspace.tsx`

- [ ] **Step 1: Create the workspace component**

This is the main workspace page. It contains:
- Toolbar with FileCreatorPill + collapse toggle + optional gear icon
- 3 accordion sections (Cable Model, WMM Geomagnetic, Bathymetry)
- File cards in 3-column grid per section
- Uses existing `ProjectAvatar`, `ConfirmDialog`, `Breadcrumbs`

```tsx
// frontend/src/components/ui/project-workspace.tsx
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Minus, Plus, ChevronDown, Trash2, Settings, Cable, Globe, Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "@/components/ui/project-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FileCreatorPill } from "@/components/ui/file-creator-pill";
import {
  getLocalFiles, createLocalFile, deleteLocalFile,
  getTeamFiles, createTeamFile, deleteTeamFile,
} from "@/lib/project-files";
import type { ProjectFile, FileCategory, CableSubType } from "@/types/project-files";
import { CATEGORY_LABELS, TEAM_FILE_LIMIT } from "@/types/project-files";

const snappySpring = { type: "spring", stiffness: 350, damping: 30, mass: 1 } as const;

// ── Props ──

interface ProjectWorkspaceProps {
  projectId: string;
  projectName: string;
  projectType: "local" | "team";
  myRole?: "Owner" | "Editor" | "Viewer";
  onGoToProjects: () => void;
  onSelectFile: (fileId: string, fileName: string) => void;
  onOpenSettings?: () => void;
}

// ── Category config ──

const categoryConfig: { id: FileCategory; label: string; icon: typeof Cable }[] = [
  { id: "cable", label: "Cable Model", icon: Cable },
  { id: "wmm", label: "WMM Geomagnetic", icon: Globe },
  { id: "bathymetry", label: "Bathymetry", icon: Waves },
];

// ── Main Component ──

export function ProjectWorkspace({
  projectId,
  projectName,
  projectType,
  myRole,
  onGoToProjects,
  onSelectFile,
  onOpenSettings,
}: ProjectWorkspaceProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<FileCategory, boolean>>({
    cable: false,
    wmm: false,
    bathymetry: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);

  const isTeam = projectType === "team";
  const canEdit = !isTeam || myRole === "Owner" || myRole === "Editor";

  // ── Load files ──

  const loadFiles = useCallback(async () => {
    try {
      const data = isTeam
        ? await getTeamFiles(projectId)
        : await getLocalFiles(projectId);
      setFiles(data);
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, isTeam]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  // ── Handlers ──

  const handleCreateFile = async (category: FileCategory, subType?: CableSubType) => {
    const file = isTeam
      ? await createTeamFile(projectId, category, subType)
      : await createLocalFile(projectId, category, subType);
    setFiles((prev) => [...prev, file]);
  };

  const handleDeleteFile = async () => {
    if (!deleteTarget) return;
    try {
      if (isTeam) {
        await deleteTeamFile(projectId, deleteTarget.id);
      } else {
        await deleteLocalFile(projectId, deleteTarget.id);
      }
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleAllCollapsed = () => {
    const newState = !allCollapsed;
    setAllCollapsed(newState);
    setCollapsedSections({ cable: newState, wmm: newState, bathymetry: newState });
  };

  const toggleSection = (category: FileCategory) => {
    setCollapsedSections((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const filesByCategory = (category: FileCategory) =>
    files.filter((f) => f.category === category);

  // ── Render ──

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="w-full px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display text-[22px] tracking-[0.2em] text-foreground">ELECTROFISH</span>
            <div className="w-px h-6 bg-border-accent" />
            <Breadcrumbs
              items={[
                { label: "Projects", onClick: onGoToProjects },
                { label: projectName },
              ]}
            />
          </div>
          {isTeam && myRole === "Owner" && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              data-magnetic
              className="p-2 rounded-xl text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-none"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Toolbar */}
      <div className="px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canEdit && (
            <FileCreatorPill
              onCreateFile={handleCreateFile}
              disabled={!canEdit}
              fileCount={isTeam ? files.length : undefined}
              fileLimit={isTeam ? TEAM_FILE_LIMIT : undefined}
            />
          )}

          {/* Collapse toggle */}
          <motion.button
            layout
            transition={snappySpring}
            onClick={toggleAllCollapsed}
            data-magnetic
            className="flex items-center gap-1.5 rounded-3xl bg-[#1c1c1c] px-3 py-2 text-[#888] hover:text-white transition-colors cursor-none"
          >
            {allCollapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
      </div>

      {/* Category sections */}
      <main className="flex-1 px-12 pb-12 space-y-6">
        {loading ? (
          /* Skeleton loading */
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-10 w-48 bg-[#1c1c1c] rounded-xl animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-24 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          categoryConfig.map((cat) => {
            const catFiles = filesByCategory(cat.id);
            const isCollapsed = collapsedSections[cat.id];

            return (
              <div key={cat.id}>
                {/* Section header */}
                <button
                  onClick={() => toggleSection(cat.id)}
                  data-magnetic
                  className="flex items-center gap-3 mb-3 group cursor-none"
                >
                  <cat.icon className={cn("w-4 h-4", isCollapsed ? "text-[#888]" : "text-white")} />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    isCollapsed ? "text-[#888] group-hover:text-white" : "text-white"
                  )}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-[#555] bg-[#1c1c1c] px-2 py-0.5 rounded-full">
                    {catFiles.length}
                  </span>
                  <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={snappySpring}
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-[#555]" />
                  </motion.div>
                </button>

                {/* Section content */}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={snappySpring}
                      className="overflow-hidden"
                    >
                      {catFiles.length === 0 ? (
                        <div className="border border-dashed border-[#333] rounded-2xl p-8 text-center">
                          <span className="text-sm text-[#555]">No files yet</span>
                        </div>
                      ) : (
                        <motion.div layout transition={snappySpring} className="grid grid-cols-3 gap-4">
                          {catFiles.map((file) => (
                            <FileCard
                              key={file.id}
                              file={file}
                              canDelete={canEdit}
                              onClick={() => onSelectFile(file.id, file.name)}
                              onDelete={() => setDeleteTarget(file)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface/80 backdrop-blur-sm h-10 flex items-center justify-between px-12">
        <span className="text-[11px] text-muted">University of Southampton — EPE Research Group</span>
        <span className="font-mono text-[11px] text-muted">2026</span>
      </footer>

      {/* Delete confirmation — ConfirmDialog returns null when open=false */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteFile}
        mode="destructive"
        name={deleteTarget?.name ?? ""}
        itemType="file"
      />
    </div>
  );
}

// ── FileCard (internal) ──

interface FileCardProps {
  file: ProjectFile;
  canDelete: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function FileCard({ file, canDelete, onClick, onDelete }: FileCardProps) {
  const typeLabel = file.category === "cable"
    ? (file.sub_type === "dc_bipole" ? "DC Bipole" : "HVAC")
    : file.category === "wmm"
      ? "WMM"
      : "Bathymetry";

  const dateStr = new Date(file.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="group relative bg-[#111] border border-[#222] hover:border-[#333] rounded-2xl p-4 transition-colors cursor-none"
      data-magnetic
    >
      <div className="flex items-start gap-3">
        <ProjectAvatar projectId={file.id} className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{file.name}</p>
          <p className="text-xs text-[#888]">
            {typeLabel}
            <span className="text-[#555]"> · {dateStr}</span>
          </p>
        </div>
      </div>

      {/* Hover actions */}
      {canDelete && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-magnetic
            className="p-1.5 rounded-lg text-[#666] hover:text-error hover:bg-[#222] transition-colors cursor-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/project-workspace.tsx
git commit -m "feat: add ProjectWorkspace component with category sections and file cards"
```

---

## Task 8: Wire Up Navigation — App.tsx

**Files:**
- Modify: `frontend/src/App.tsx` (lines 26, 48-60, 298-301, 426-469)
- Modify: `frontend/src/components/ui/projects-collection.tsx` (line 53)

- [ ] **Step 1: Update onSelectProject callback in projects-collection.tsx**

In `frontend/src/components/ui/projects-collection.tsx`, change the `onSelectProject` prop type (line 53) from:
```typescript
onSelectProject: (projectId: string) => void;
```
to:
```typescript
onSelectProject: (projectId: string, projectType: "local" | "team", projectName: string) => void;
```

Then update `LocalProjectCard` click handler (line 192) from:
```typescript
onClick={() => onSelectProject(project.id)}
```
to:
```typescript
onClick={() => onSelectProject(project.id, "local", project.name)}
```

And `TeamProjectCard` click handler (line 247) from:
```typescript
onClick={() => onSelectProject(project.id)}
```
to:
```typescript
onClick={() => onSelectProject(project.id, "team", project.name)}
```

- [ ] **Step 2: Update App.tsx**

In `frontend/src/App.tsx`:

**a) Update AppView type (line 26):**
```typescript
type AppView = "onboarding" | "landing" | "projects" | "pick-type" | "setup-form" | "create-local" | "workspace" | "dashboard";
```

**b) Add new state vars (after line 60):**
```typescript
const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
const [activeProjectType, setActiveProjectType] = useState<"local" | "team">("local");
const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
const [activeFileId, setActiveFileId] = useState<string | null>(null);
const [activeFileName, setActiveFileName] = useState<string | null>(null);
```

**c) Add import for ProjectWorkspace and Breadcrumbs** (at top of file):
```typescript
import { ProjectWorkspace } from "@/components/ui/project-workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
```

**d) Update onSelectProject callback (lines 298-301):**
```typescript
onSelectProject={(projectId, projectType, projectName) => {
  setActiveProjectId(projectId);
  setActiveProjectType(projectType);
  setActiveProjectName(projectName);
  setView("workspace");
}}
```

**e) Add workspace view render** (before the dashboard return at line 426, add):
```tsx
// Workspace
if (view === "workspace" && activeProjectId && activeProjectName) {
  return (
    <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
      {profileDropdown}
      {editModal}
      <ProjectWorkspace
        projectId={activeProjectId}
        projectName={activeProjectName}
        projectType={activeProjectType}
        onGoToProjects={() => {
          setActiveProjectId(null);
          setActiveProjectName(null);
          setView("projects");
        }}
        onSelectFile={(fileId, fileName) => {
          setActiveFileId(fileId);
          setActiveFileName(fileName);
          setView("dashboard");
        }}
      />
    </MagneticCursor>
  );
}
```

**f) Add breadcrumbs to dashboard header** (in the dashboard return, lines 432-439, replace the header content):

Replace the header `<div>` children with:
```tsx
<div className="flex items-center gap-4">
  <span className="font-display text-[22px] tracking-[0.2em] text-foreground">ELECTROFISH</span>
  <div className="w-px h-6 bg-border-accent" />
  {activeProjectName ? (
    <Breadcrumbs
      items={[
        { label: "Projects", onClick: () => { setActiveFileId(null); setActiveFileName(null); setActiveProjectId(null); setView("projects"); } },
        { label: activeProjectName, onClick: () => { setActiveFileId(null); setActiveFileName(null); setView("workspace"); } },
        { label: activeFileName ?? "Dashboard" },
      ]}
    />
  ) : (
    <span className="font-mono text-[11px] text-muted">v2.0</span>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/ui/projects-collection.tsx
git commit -m "feat: wire workspace navigation with breadcrumbs in App.tsx"
```

---

## Task 9: Wire Up Navigation — OfflineApp.tsx

**Files:**
- Modify: `frontend/src/components/OfflineApp.tsx` (lines 25, 81-83, 325-381)

- [ ] **Step 1: Update OfflineApp**

**a) Update OfflineView type (line 25):**
```typescript
type OfflineView = "landing" | "projects" | "create" | "workspace" | "dashboard";
```

**b) Add new state vars (after line 37):**
```typescript
const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
const [activeFileId, setActiveFileId] = useState<string | null>(null);
const [activeFileName, setActiveFileName] = useState<string | null>(null);
```

**c) Add imports** (at top):
```typescript
import { ProjectWorkspace } from "@/components/ui/project-workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
```

**d) Update handleSelectProject (lines 81-83):**
```typescript
const handleSelectProject = (id: string) => {
  setActiveProjectId(id);
  const project = localProjects.find((p) => p.id === id);
  setActiveProjectName(project?.name ?? "Project");
  setView("workspace");
};
```

**e) Add workspace render** (before the dashboard section):
```tsx
if (view === "workspace" && activeProjectId && activeProjectName) {
  return (
    <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
      <div className="min-h-screen flex flex-col bg-background">
        <ProjectWorkspace
          projectId={activeProjectId}
          projectName={activeProjectName}
          projectType="local"
          onGoToProjects={() => {
            setActiveProjectId(null);
            setActiveProjectName(null);
            setView("projects");
          }}
          onSelectFile={(fileId, fileName) => {
            setActiveFileId(fileId);
            setActiveFileName(fileName);
            setView("dashboard");
          }}
        />
      </div>
    </MagneticCursor>
  );
}
```

**f) Add breadcrumbs to offline dashboard header** (in the dashboard return section around lines 328-352):

Add breadcrumbs alongside the ELECTROFISH logo, same pattern as App.tsx.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/OfflineApp.tsx
git commit -m "feat: wire workspace navigation in OfflineApp"
```

---

## Task 10: Integration Test

- [ ] **Step 1: Start the backend**

```bash
cd backend && python -m uvicorn main:app --reload --port 8000
```

- [ ] **Step 2: Start the frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Manual test flow — Personal (offline)**

1. Open app → choose "Work Offline"
2. Create a project (or select existing)
3. Verify workspace page loads with 3 empty category sections
4. Click + pill → verify it expands with Cable Model / WMM / Bathymetry options
5. Select WMM → click checkmark → verify "WMM #1" card appears in WMM section
6. Select Cable Model → verify HVAC / DC Bipole sub-selector appears
7. Select HVAC → click checkmark → verify "Cable HVAC #1" card appears in Cable section
8. Create another Cable HVAC → verify "Cable HVAC #2"
9. Delete Cable HVAC #1 → type name to confirm → verify card removed
10. Create another Cable HVAC → verify "Cable HVAC #3" (not #1 — max-based naming)
11. Click - button → verify all sections collapse
12. Click + button → verify all sections expand
13. Click a file card → verify dashboard loads with breadcrumbs
14. Click project name in breadcrumb → verify returns to workspace
15. Click "Projects" in breadcrumb → verify returns to projects grid

- [ ] **Step 4: Manual test flow — Team**

1. Sign in → select/create a team project
2. Verify workspace loads
3. Create 4 files (any combination)
4. Verify file count shows "4 / 4 files"
5. Verify + button is disabled
6. Delete one file → verify count updates and + button re-enables

- [ ] **Step 5: Commit any fixes found during testing**

```bash
git add -A
git commit -m "fix: integration test fixes for project workspace"
```
