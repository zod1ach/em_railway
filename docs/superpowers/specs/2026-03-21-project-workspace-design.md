# Project Workspace Design Spec

**Date:** 2026-03-21
**Feature:** Project Workspace — the page users see when clicking a project card
**Status:** Approved

---

## Overview

The Project Workspace is the central hub for managing model files within a project. Users reach it by clicking any project card (Personal or Team) from the projects grid. It displays categorised model files and provides file creation, deletion, and navigation into individual model calculators.

## Navigation Flow

```
Projects grid → click card → Workspace → click file card → Dashboard (calculator)
```

### Breadcrumb Navigation

The dashboard header displays breadcrumbs: `Projects > My Project > HVAC Cable #2`

- Click **Projects** → back to projects grid
- Click **My Project** → back to workspace
- File name → non-clickable (current location)

No back arrows. Breadcrumbs are the sole navigation mechanism.

### AppView Changes

Add `"workspace"` to the existing `AppView` type:

```ts
type AppView = "onboarding" | "landing" | "projects" | "pick-type" | "setup-form" | "create-local" | "workspace" | "dashboard";
```

New state required in App.tsx:
- `activeProjectId: string | null`
- `activeProjectType: "local" | "team"`
- `activeProjectName: string | null`
- `activeFileId: string | null`
- `activeFileName: string | null`

### State Flow

State is managed in `App.tsx` and passed as props:

1. **Projects grid → Workspace:** `onSelectProject(id, type, name)` sets `activeProjectId`, `activeProjectType`, `activeProjectName` and calls `setView("workspace")`. The callback signature in `projects-collection.tsx` must be updated to `(projectId: string, projectType: "local" | "team", projectName: string) => void`.

2. **Workspace → Dashboard:** `ProjectWorkspace` receives `activeProjectId`, `activeProjectType`, `activeProjectName` as props. When a file card is clicked, it calls `onSelectFile(fileId, fileName)` which sets `activeFileId`, `activeFileName` and calls `setView("dashboard")`.

3. **Dashboard:** Receives all active state as props plus breadcrumb callbacks `onGoToProjects` and `onGoToWorkspace` that reset the relevant state and call `setView`.

No React context needed — props are sufficient for this 3-level navigation.

---

## Data Model

### ProjectFile Type

```ts
interface ProjectFile {
  id: string;
  project_id: string;
  category: "cable" | "wmm" | "bathymetry";
  sub_type?: "hvac" | "dc_bipole";  // only when category === "cable"
  name: string;                      // auto-generated
  created_at: string;
  updated_at: string;
}
```

### Auto-naming

Names use `MAX(numeric_suffix) + 1` to avoid duplicates after deletion. If files "Cable HVAC #1" and "Cable HVAC #3" exist (after #2 was deleted), the next file is "Cable HVAC #4".

Naming patterns:
- Cable HVAC files: "Cable HVAC #1", "Cable HVAC #2", ...
- Cable DC Bipole files: "Cable DC Bipole #1", ...
- WMM files: "WMM #1", "WMM #2", ...
- Bathymetry files: "Bathymetry #1", "Bathymetry #2", ...

**Name generation is server-side only.** The FastAPI backend generates names for local projects. For team projects, a Supabase database function generates names. The frontend never generates names — it sends `{ category, sub_type? }` and receives the created file with its name.

### File Limits

- **Personal projects:** Unlimited files, any combination
- **Team projects:** Maximum 4 files total per project (any combination of the 3 categories and any sub-types)

---

## Storage

### Personal Projects (SQLite via FastAPI)

New `project_files` table in `local_projects.db`:

```sql
CREATE TABLE project_files (
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
```

New FastAPI endpoints under `/api/local-projects/{project_id}/files`:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/local-projects/{id}/files` | List all files for a project |
| POST | `/api/local-projects/{id}/files` | Create file (`{ category, sub_type? }`) |
| DELETE | `/api/local-projects/{id}/files/{file_id}` | Delete a file |

The POST endpoint auto-generates the file name by counting existing files of the same category+sub_type.

### Team Projects (Supabase)

New `project_files` table:

```sql
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('cable', 'wmm', 'bathymetry')),
  sub_type TEXT CHECK (
    (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
    OR (category != 'cable' AND sub_type IS NULL)
  ),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

RLS policies:
- **SELECT:** Any project member (Owner/Editor/Viewer) can read files
- **INSERT:** Only Owner/Editor can create files
- **DELETE:** Only Owner/Editor can delete files

**4-file limit enforcement:** A `BEFORE INSERT` trigger on `project_files` counts existing rows for the project and raises an exception if count >= 4. Client-side also disables the + button when count >= 4 (optimistic guard; server is authoritative).

**`created_by` column:** Include `created_by UUID REFERENCES auth.users(id)` for audit trails.

```sql
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
```

---

## Workspace Layout

### Top Toolbar

```
[+ pill]  [- pill]                        "3 / 4 files" (team only)
```

- **+ pill:** File creator (adapted day-picker pattern)
- **- pill:** Collapse/expand all category sections
- **File count:** Only shown in team mode, right-aligned

### Category Sections

Three sections always present: Cable Model, WMM Geomagnetic, Bathymetry.

Each section has:
- Category header tab (animated, same style as Personal/Team tabs with `layoutId` active indicator)
- File count badge next to label
- Collapsible content with `AnimatePresence` height animation
- 3-column file card grid inside

### File Cards

3-column grid (`grid-cols-3 gap-4`), each card contains:
- `ProjectAvatar` (marble variant, seeded by file ID)
- File name (white, font-medium)
- Type badge: "HVAC" / "DC Bipole" / "WMM" / "Bathymetry" in `text-[#888]`
- Created date in `text-[#555]`
- Hover action bar (`opacity-0 group-hover:opacity-100`): trash icon only (DownloadButton deferred — no file data to export yet)
- Delete triggers `ConfirmDialog` in destructive mode (type name to confirm)
- Click navigates to dashboard with breadcrumbs set

Empty state per category: dashed-border placeholder with "No files yet" text.

### Error Handling

- **File creation failure:** Toast notification with error message, pill remains expanded so user can retry
- **File deletion failure:** Toast notification, file card remains
- **Backend unreachable (local):** Toast "Cannot connect to local server" when workspace loads
- **Network failure (team):** Toast with retry option
- **Project deleted while viewing workspace:** Redirect to projects grid with toast "Project no longer exists"

### Loading States

- Workspace shows skeleton cards (3 placeholders per category) while files are being fetched
- FileCreatorPill shows a spinner in the confirm button while creating

---

## Component: FileCreatorPill (+ Button)

Adapted from the day-picker component (0xUrvish/day-picker). All `@hugeicons` icons replaced with `lucide-react`. Uses `motion/react`.

### States

**Collapsed (default):**
- Compact dark pill: `bg-[#1c1c1c] rounded-3xl`
- Shows `Plus` icon + label "New File" + `ChevronsUpDown` icon
- Spring animation on hover

**Expanded (options visible):**
- Pill expands with `springTransition` (`{ type: "spring", damping: 30, stiffness: 400, mass: 1 }`)
- Shows 3 options: Cable Model, WMM Geomagnetic, Bathymetry
- Each option has `layoutId` active pill indicator
- Checkmark button (accent `#CCFF00` background) to confirm

**Cable sub-type row:**
- When "Cable Model" is selected, a second row appears with `AnimatePresence` height animation
- Shows HVAC / DC Bipole options, styled like the smooth-dropdown (left-bar active indicator + hover background)
- Selecting a sub-type + clicking checkmark creates the file

**WMM / Bathymetry flow:**
- Select option → click checkmark → file created immediately, pill collapses

**Team mode disabled state:**
- When file count >= 4, pill shows muted/disabled appearance
- Click shows tooltip or does nothing

### Theming

- Pill background: `bg-[#1c1c1c]`
- Option background: `bg-[#0d0d0d]`
- Active option pill: `bg-[#222]`
- Confirm button: `bg-[#CCFF00] text-black`
- Text: `text-white` active, `text-[#888]` inactive
- All elements: `cursor-none` (magnetic cursor)

---

## Component: Collapse Toggle (- Button)

Same pill style as FileCreatorPill:
- Compact pill with `Minus` / `Plus` icon (toggles)
- Click toggles all 3 category sections between collapsed and expanded
- Collapsed sections show only the header tab with count badge
- Spring animation on state change

---

## Component: CategorySection

Renders a single category (Cable Model / WMM Geomagnetic / Bathymetry).

### Header (Section Label)

These are **accordion sections** (all visible, individually collapsible), NOT tabs. All 3 categories are always visible as section headers. Clicking a header toggles that section's collapse state.

Styling matches the Personal/Team tab aesthetic but functions as section headers:
- `motion.div` with category icon + label + count badge
- Expanded: `text-white` with subtle bottom border
- Collapsed: `text-[#888]`, hover → `text-white`
- Chevron icon rotates to indicate collapse state
- `{ type: "spring", stiffness: 350, damping: 30 }`

### Content

- Wrapped in `AnimatePresence` for smooth height animation on collapse/expand
- Contains 3-column grid of `FileCard` components
- Empty state: dashed border box with "No files yet" in muted text

---

## Component: FileCard

Individual model file card, consistent with existing `LocalProjectCard` / `TeamProjectCard` styling.

### Layout

```
┌──────────────────────────┐
│  ┌────────┐              │
│  │ marble │  Cable HVAC #1│
│  │ avatar │  HVAC · 21 Mar│
│  └────────┘              │
│         [download] [trash]│  ← hover only
└──────────────────────────┘
```

### Styling

- Background: `bg-[#111] border border-[#222] rounded-2xl`
- Hover: `hover:border-[#333]` transition
- Avatar: `ProjectAvatar` with file ID as seed, `w-10 h-10`
- Name: `text-white text-sm font-medium`
- Type + date: `text-[#888] text-xs` / `text-[#555] text-xs`
- Action bar: `opacity-0 group-hover:opacity-100 transition-opacity`
- `data-magnetic` on interactive elements
- `cursor-none` everywhere

### Click Behavior

Sets `activeFileId`, `activeFileName`, and navigates to `view="dashboard"`. The dashboard reads these values to load the correct calculator tab and display breadcrumbs.

---

## Component: Breadcrumbs

New component for the dashboard header.

```tsx
<nav className="flex items-center gap-2 text-sm">
  <button onClick={goToProjects} className="text-[#888] hover:text-white">Projects</button>
  <ChevronRight className="w-3 h-3 text-[#555]" />
  <button onClick={goToWorkspace} className="text-[#888] hover:text-white">{projectName}</button>
  <ChevronRight className="w-3 h-3 text-[#555]" />
  <span className="text-white">{fileName}</span>
</nav>
```

Placed in the dashboard header bar, to the right of the ELECTROFISH logo, separated by a `|` divider. Breadcrumbs are only shown when `view === "dashboard"`. On the workspace view, the header shows only the ELECTROFISH logo (no breadcrumbs needed since the workspace itself is the context).

On the workspace page, a simpler breadcrumb shows: `Projects > My Project` (project name non-clickable since it's current location, "Projects" clickable to go back).

---

## Team Mode Specifics

- **File count display:** `"3 / 4 files"` badge near + button, `text-[#888]`, count in `text-white`
- **At limit:** + button disabled, muted appearance
- **Gear icon:** Top-right of workspace toolbar, only visible when `my_role === "Owner"` (opens existing project settings modal)
- **Permissions:**
  - Owner/Editor: create files, delete files, view files
  - Viewer: view files only (+ button hidden, no delete actions)

---

## Frontend Lib: project-files.ts

New file `frontend/src/lib/project-files.ts` with functions for both storage backends:

```ts
// Local (SQLite via FastAPI)
getLocalFiles(projectId: string): Promise<ProjectFile[]>
createLocalFile(projectId: string, category: string, subType?: string): Promise<ProjectFile>
deleteLocalFile(projectId: string, fileId: string): Promise<void>

// Team (Supabase)
getTeamFiles(projectId: string): Promise<ProjectFile[]>
createTeamFile(projectId: string, category: string, subType?: string): Promise<ProjectFile>
deleteTeamFile(projectId: string, fileId: string): Promise<void>
```

The frontend does **not** generate file names. It sends `{ category, sub_type? }` to the backend, which returns the created file with the auto-generated name. These functions are thin wrappers around API calls.

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `frontend/src/components/ui/project-workspace.tsx` | Main workspace page with CategorySection and FileCard |
| `frontend/src/components/ui/file-creator-pill.tsx` | + button adapted from day-picker |
| `frontend/src/components/ui/breadcrumbs.tsx` | Breadcrumb navigation |
| `frontend/src/lib/project-files.ts` | CRUD functions for both storage backends |
| `frontend/src/types/project-files.ts` | ProjectFile type definition |
| `backend/api/project_files.py` | FastAPI endpoints for local project files |

### Modified Files
| File | Change |
|------|--------|
| `frontend/src/App.tsx` | Add "workspace" view, activeProject/activeFile state, breadcrumbs in dashboard, route to workspace on project card click |
| `frontend/src/components/ui/projects-collection.tsx` | Wire project card click to navigate to workspace instead of dashboard |
| `frontend/src/components/OfflineApp.tsx` | Add "workspace" to `OfflineView`, same flow as App.tsx — project click → workspace → file click → dashboard. Shares the same `ProjectWorkspace` component with `projectType="local"` |
| `backend/main.py` | Register new project_files router |

### Supabase Migration
| File | Purpose |
|------|---------|
| `supabase/migrations/XXX_project_files.sql` | Create project_files table + RLS policies |

---

## Design Tokens

All styling matches the existing dark theme:

| Token | Value |
|-------|-------|
| Page background | `bg-[#0d0d0d]` or `bg-background` |
| Card background | `bg-[#111]` |
| Card border | `border-[#222]` |
| Card hover border | `border-[#333]` |
| Pill background | `bg-[#1c1c1c]` |
| Active tab pill | `bg-white` |
| Accent | `#CCFF00` |
| Text primary | `text-white` |
| Text secondary | `text-[#888]` |
| Text muted | `text-[#555]` |
| Spring (snappy) | `{ type: "spring", stiffness: 350, damping: 30, mass: 1 }` — used for layout/tabs |
| Spring (pill) | `{ type: "spring", stiffness: 400, damping: 30, mass: 1 }` — used for FileCreatorPill (matches day-picker) |
| Grid | `grid-cols-3 gap-4` |
| Border radius | `rounded-2xl` (cards), `rounded-3xl` (pills) |

---

## Existing Dashboard Tabs

The current tabs (HVAC NON-MAG, HVAC MAGNETIC, DC BIPOLE, WMM, CABLE 3D) remain as-is for reference. They will be replaced in a future iteration. For now, clicking a file card navigates to the dashboard and these tabs are visible.

---

## Relationship to Existing Data

The existing `project_data` table (storing `hvac_params`, `dc_params`, `wmm_params`, `cable_3d_params` per project) remains **unchanged**. The new `project_files` table stores file metadata only. In the future, each file will get its own parameter storage, but for now the old `project_data` table and the new `project_files` table are independent.

The `updated_at` field on `ProjectFile` is reserved for future use (when files store calculator data). For V1 it always equals `created_at`.

---

## Out of Scope

- File data persistence (actual calculator parameters per file) — future work
- Replacing the existing dashboard tabs with per-file calculators — future work
- File renaming or reordering
- Drag-and-drop between categories
- File duplication
- File download/export (no data to export yet)
- Responsive breakpoints for file grid (desktop-only for now)
