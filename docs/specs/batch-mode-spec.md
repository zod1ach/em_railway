# Batch Mode — Design Specification

> **Status**: Draft — awaiting user review
> **Scope**: Personal mode only (HVAC + DC Bipole)
> **Branch**: `feature/hybrid-storage-architecture`

---

## 1. Overview

Batch mode generates multiple **input parameter files** by sweeping one or more parameters across defined ranges. These files are stored under a batch folder which sits beneath a parent cable model file. Each file is a complete parameter set ready to be loaded into an N8N-style flow for calculation.

**Files are NOT results** — they are input configurations. Calculated fields (peak B, peak E) only appear after the flow has been executed.

---

## 2. Architecture

### 2.1 Tree Structure

```
Cable Model/
  ├── North Sea HVAC           (@northsea)       ← parent file
  │     └── 📦 Current Sweep   (@current_sweep)  ← batch folder (28 runs)
  │           (not expanded — click opens Batch Explorer)
  ├── Channel DC Link          (@channel)
  │     └── 📦 Route Scan      (@route_scan)     ← batch folder (15 runs)
  └── Baltic HVAC              (@baltic)
```

- Batch folders appear as children of their **parent cable file**
- The parent file provides **all base parameter values** (snapshot frozen at batch creation)
- Batch folders use a 📦 icon in `#CCFF00` to distinguish from regular files
- Clicking a batch folder does NOT expand it — it opens the **Batch Explorer** panel
- A static child label shows run count (e.g., "28 runs") — not clickable

### 2.2 @tag System

The @tag is the **primary identifier** that flows use to reference files.

| Rule | Detail |
|------|--------|
| Format | Lowercase, alphanumeric + underscores. e.g., `@current_sweep` |
| Uniqueness | **Unique per project** — enforced at DB level |
| Batch files | Inherit batch tag with suffix: `@current_sweep/run001` |
| Flow references | Single file: `@current_sweep/run001`, All: `@current_sweep/*`, Filtered: via explorer selection |
| Validation | Check uniqueness on creation, prevent duplicates |

### 2.3 Parent-as-Base-Config

When a batch folder is created under a parent file:
1. **Snapshot** all current parameter values from the parent
2. Store as `base_params` JSON in the batch folder record
3. The snapshot is **frozen** — later edits to the parent don't affect the batch
4. Each generated file = base_params + overridden swept values
5. This avoids redundant data entry and ensures reproducibility

---

## 3. Creation Wizard

### 3.1 HVAC Flow (4 steps)

**Step 1: Name + @tag**
```
┌─────────────────────────────────────────┐
│  Batch Name:    [ Current Sweep       ] │
│  @tag:          [ current_sweep       ] │
│                                         │
│  Parent: North Sea HVAC (@northsea)     │
│  Base config snapshot will be taken.    │
│                                         │
│                          [Next →]       │
└─────────────────────────────────────────┘
```
- Auto-suggest @tag from name (lowercase, spaces → underscores)
- Validate uniqueness in real-time
- Show parent file name for confirmation

**Step 2: Magnetic Toggle**
```
┌─────────────────────────────────────────┐
│  Calculation Type                       │
│                                         │
│  ○ Non-Magnetic                         │
│  ● Magnetic                             │
│                                         │
│  (Inherited from parent: Magnetic)      │
│                          [Next →]       │
└─────────────────────────────────────────┘
```
- Pre-selected from parent's `magnetic` flag
- User can override (this affects which params are available to sweep)

**Step 3: Configure Sweeps**
```
┌──────────────────────────────────────────────────────────────────┐
│  Select parameters to sweep                                      │
│                                                                  │
│  ☑ I_AC (Current)           Range: [ 500 ] to [ 1500 ] step [ 100 ]  A │
│     → 11 values: 500, 600, 700, ..., 1500                       │
│                                                                  │
│  ☑ s (Conductor Spacing)    Range: [ 0.05 ] to [ 0.15 ] step [ 0.02 ] m │
│     → 6 values: 0.05, 0.07, 0.09, 0.11, 0.13, 0.15             │
│                                                                  │
│  ☐ p_c (Lay Length)         [not swept — using base: 2.75 m]    │
│  ☐ R_h (Helix Radius)      [not swept — using base: 0.060391 m]│
│  ☐ r_AC (Cable Radius)     [not swept — using base: 0.1225 m]  │
│  ... (all other params listed, unchecked)                        │
│                                                                  │
│  ──────────────────────────────────────────────────────          │
│  📊 Combinations: 11 × 6 = 66 files                             │
│  💾 Estimated size: ~0.8 MB                                      │
│                                                                  │
│  ┌────────────────────────────────────────────┐                  │
│  │  ● 66 files    ✅ Within limit (500 max)   │                  │
│  └────────────────────────────────────────────┘                  │
│                                                                  │
│                          [Next →]                                │
└──────────────────────────────────────────────────────────────────┘
```

**Per-parameter controls:**
- **Checkbox** to enable/disable sweep
- **Mode toggle**: Range (min/max/step) or List (comma-separated values)
- **Preview**: shows discrete values that will be generated
- **Validation**: step must divide range evenly (or warn about rounding)

**Live counter:**
- Shows multiplication: `11 × 6 = 66 files`
- Updates in real-time as user changes ranges
- **Color thresholds**:
  - 1–100: Green ✅
  - 101–250: Amber ⚠️ "Large batch"
  - 251–500: Red 🔴 "Very large batch — consider reducing"
  - 501+: Blocked ❌ "Exceeds 500 file limit — reduce ranges or increase step"
- **Size estimate**: `count × avg_file_size_bytes` (avg ~12KB per file for HVAC)

**Step 4: Review + Generate**
```
┌──────────────────────────────────────────────────────────────────┐
│  Review Batch Configuration                                      │
│                                                                  │
│  Name: Current Sweep                                             │
│  @tag: @current_sweep                                            │
│  Parent: North Sea HVAC (@northsea)                              │
│  Type: HVAC Magnetic                                             │
│                                                                  │
│  Swept Parameters:                                               │
│    I_AC:  500 → 1500  step 100  (11 values)                     │
│    s:     0.05 → 0.15 step 0.02 (6 values)                      │
│                                                                  │
│  Fixed Parameters (from parent snapshot):                        │
│    p_c=2.75, R_h=0.060391, r_AC=0.1225, d_s=0.0958, ...        │
│    [show all 16 fixed params]                                    │
│                                                                  │
│  Total: 66 files │ ~0.8 MB                                       │
│                                                                  │
│  File naming preview:                                            │
│    @current_sweep/run001  (I_AC=500, s=0.05)                    │
│    @current_sweep/run002  (I_AC=500, s=0.07)                    │
│    @current_sweep/run003  (I_AC=500, s=0.09)                    │
│    ...                                                           │
│                                                                  │
│              [← Back]  [Generate 66 Files]                       │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 DC Bipole Flow (4 steps)

**Step 1: Name + @tag** — identical to HVAC

**Step 2: Mode Selection**
```
┌─────────────────────────────────────────────────────────┐
│  Batch Mode                                             │
│                                                         │
│  ● Cable Mode                                           │
│    Sweep cable parameters for one fixed location        │
│                                                         │
│  ○ Location Mode                                        │
│    Sweep a fixed cable model across multiple locations   │
│    (Define a transect line, like WMM Line mode)         │
│                                                         │
│                                      [Next →]           │
└─────────────────────────────────────────────────────────┘
```

**Step 3a: Cable Mode — Configure Sweeps**
- Same UI as HVAC Step 3
- Available params: `r_DC`, `cable_angle`, `cable_slope`, `I_DC`
- B_earth components locked (they come from location)
- Same cap: 500 max files

**Step 3b: Location Mode — Define Transect**
```
┌──────────────────────────────────────────────────────────────────┐
│  Define Transect Line                                            │
│                                                                  │
│  Waypoints (min 2):                                              │
│    1. Lat: [ 50.5000 ]  Lng: [ -1.2000 ]         [×]           │
│    2. Lat: [ 51.0000 ]  Lng: [ -0.8000 ]         [×]           │
│    3. Lat: [ 51.5000 ]  Lng: [ -0.5000 ]         [×]           │
│                                         [+ Add Waypoint]        │
│                                                                  │
│  Interpolation:                                                  │
│    Total points: [ 50 ]  (max 500)                               │
│    Method: ● Linear  ○ Great Circle                              │
│                                                                  │
│  ──────────────────────────────────────────────────────          │
│  📊 50 points along transect = 50 files                          │
│  💾 Estimated size: ~0.6 MB                                      │
│  📍 Each point triggers WMM lookup for B_earth components        │
│                                                                  │
│  Cap: ✅ 50 / 500 max                                            │
│                          [Next →]                                │
└──────────────────────────────────────────────────────────────────┘
```

- Waypoints defined exactly like WMM Line mode (reuse that UI)
- Interpolation between waypoints for given number of points
- Each interpolated point gets a WMM lookup → B_earth_X, B_earth_Y, B_earth_Z
- Cable params are fixed from parent snapshot
- Cap tiers: 100 (green), 250 (amber), 500 (hard max)

**Step 4: Review + Generate** — same pattern as HVAC

---

## 4. Database Schema

### 4.1 New Tables

```sql
-- Batch folder metadata
CREATE TABLE batch_folders (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    tag TEXT NOT NULL,
    cable_model_type TEXT NOT NULL CHECK (cable_model_type IN ('hvac', 'dc_bipole')),
    batch_mode TEXT CHECK (batch_mode IN ('magnetic', 'non_magnetic', 'cable', 'location')),
    base_params TEXT NOT NULL,          -- JSON: frozen snapshot of parent params
    sweep_config TEXT NOT NULL,         -- JSON: SweepConfig object
    total_runs INTEGER NOT NULL,
    estimated_size_bytes INTEGER,
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'generating', 'ready', 'error')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(project_id, tag)
);

-- Normalized sweep axes for fast querying
CREATE TABLE batch_sweep_axes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL REFERENCES batch_folders(id) ON DELETE CASCADE,
    param_key TEXT NOT NULL,
    param_label TEXT NOT NULL,
    unit TEXT NOT NULL,
    min_val REAL NOT NULL,
    max_val REAL NOT NULL,
    step_val REAL,                      -- NULL for list mode or location mode
    values_json TEXT NOT NULL,           -- JSON array of actual discrete values
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Per-file swept parameter values (indexed for filtering)
CREATE TABLE batch_run_parameters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
    batch_id TEXT NOT NULL REFERENCES batch_folders(id) ON DELETE CASCADE,
    param_key TEXT NOT NULL,
    param_value REAL NOT NULL
);
CREATE INDEX idx_brp_batch_param ON batch_run_parameters(batch_id, param_key, param_value);
CREATE INDEX idx_brp_file ON batch_run_parameters(file_id);
```

### 4.2 Altered Tables

```sql
-- Add batch columns to project_files
ALTER TABLE project_files ADD COLUMN batch_folder_id TEXT REFERENCES batch_folders(id) ON DELETE CASCADE;
ALTER TABLE project_files ADD COLUMN batch_run_number INTEGER;

-- Add calculated results columns (populated after flow execution)
ALTER TABLE project_files ADD COLUMN calc_peak_b_field REAL;
ALTER TABLE project_files ADD COLUMN calc_peak_e_field REAL;
ALTER TABLE project_files ADD COLUMN calc_status TEXT CHECK (calc_status IN ('pending', 'running', 'completed', 'error'));
```

### 4.3 TypeScript Types

```typescript
// New types to add to project-files.ts

export type BatchMode = 'magnetic' | 'non_magnetic' | 'cable' | 'location';

export interface SweepParameter {
  key: string;           // e.g., "I_AC"
  label: string;         // e.g., "Current"
  unit: string;          // e.g., "A"
  min: number;
  max: number;
  step: number | null;   // null for list mode
  values: number[];      // actual discrete values
}

export interface SweepConfig {
  parameters: SweepParameter[];
}

export interface LocationConfig {
  waypoints: { lat: number; lng: number }[];
  total_points: number;
  interpolation: 'linear' | 'great_circle';
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
  location_config?: LocationConfig;      // DC Bipole location mode only
  total_runs: number;
  estimated_size_bytes: number;
  status: 'created' | 'generating' | 'ready' | 'error';
  created_at: string;
}

export interface BatchRun {
  file_id: string;
  run_number: number;
  tag_path: string;                       // e.g., "@current_sweep/run001"
  params: Record<string, number>;         // swept param values
  calc_peak_b_field?: number;             // populated after flow execution
  calc_peak_e_field?: number;
  calc_status: 'pending' | 'running' | 'completed' | 'error';
}
```

---

## 5. Batch Explorer (Query UI)

When user clicks a batch folder in the tree, the right panel shows the Batch Explorer.

### 5.1 Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  BATCH EXPLORER                                                  │
│  "Current Sweep"  @current_sweep                  66 runs total  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  SUMMARY BAR                                                     │
│  ┌──────────────┐  ┌──────────────┐                              │
│  │ I_AC          │  │ s            │   Fixed: p_c=2.75,          │
│  │ 500 — 1500 A │  │ 0.05—0.15 m │   R_h=0.060391, ...         │
│  │ step: 100     │  │ step: 0.02   │   [show all]               │
│  │ 11 values     │  │ 6 values     │                             │
│  └──────────────┘  └──────────────┘                              │
│                                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  FILTER PANEL                                                    │
│  I_AC      [ 500 ] ──●━━━━━●── [ 1000 ]    A    [×]            │
│  s         [ --- ] ──────────── [ --- ]     m    [×]            │
│                                                                  │
│  ⚡ s: 6 distinct values [0.05][0.07][0.09][0.11][0.13][0.15]  │
│                                                                  │
│                                       Showing 36 of 66 runs     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  RESULTS TABLE                                    [Table] [Grid] │
│  ┌────┬────────┬───────┬──────────┬──────────┬─────────┐        │
│  │ ☐  │ Run #  │ I_AC  │ s (m)    │ B (μT)   │ Status  │        │
│  ├────┼────────┼───────┼──────────┼──────────┼─────────┤        │
│  │ ☐  │ 001    │ 500   │ 0.05     │ —        │ pending │        │
│  │ ☐  │ 002    │ 500   │ 0.07     │ —        │ pending │        │
│  │ ☑  │ 003    │ 500   │ 0.09     │ 12.34    │ done    │        │
│  └────┴────────┴───────┴──────────┴──────────┴─────────┘        │
│                                                                  │
│  ◀ 1/2 ▶          [Load Selected → Flow] [Load All → Flow]     │
│                    [Export CSV]                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 5.2 Summary Bar

- One card per swept parameter showing range, step, value count
- Fixed parameters collapsed in one line with `[show all]` toggle
- Styling: `bg-[#111] border border-[#222] rounded-xl`

### 5.3 Filter Panel — Progressive Narrowing

Each swept parameter gets a row with:
- **Dual-range slider** (two thumbs, snaps to discrete values)
- **Min/Max text inputs** (typing updates slider, and vice versa)
- **Clear button** `[×]` to reset that filter
- **Unit label**

**Progressive narrowing hints**:
When a filter is applied and multiple results remain, unfiltered params show:
```
⚡ s: 6 distinct values [0.05] [0.07] [0.09] [0.11] [0.13] [0.15]
```
- Clicking a pill sets exact match for that param → narrows further
- When narrowed to 1 result → prominent "Open Run #47" button appears

**Exact match shortcut**: If min === max, display shows `= 500` instead of `500 to 500`

### 5.4 Results Table

**Columns** (auto-generated from sweep config):
1. **Checkbox** — for multi-select
2. **Run #** — zero-padded, sortable
3. **One column per swept parameter** — sortable
4. **Peak B-field (μT)** — shows `—` until flow has run
5. **Peak E-field (V/m)** — shows `—` until flow has run
6. **Calc Status** — `pending` | `running` | `done` | `error`

**Pagination**: 50 rows per page. All filtering is **client-side** (load full index on open — max 500 rows is lightweight).

### 5.5 Grid/Heatmap View

Available when **exactly 2 swept parameters** are unpinned:

```
              s (m)
           0.05  0.07  0.09  0.11  0.13  0.15
        ┌──────┬──────┬──────┬──────┬──────┬──────┐
  500   │  —   │  —   │ 12.3 │  —   │  —   │  —   │
  600   │  —   │  —   │  —   │  —   │  —   │  —   │
I_AC    │  ... │      │      │      │      │      │
(A) 700 │  —   │  —   │  —   │  —   │  —   │  —   │
        └──────┴──────┴──────┴──────┴──────┴──────┘
```

- Cells show calculated value when available, `—` when pending
- Color heatmap gradient when values available
- Click cell → opens that specific run
- For 3+ swept params: pin all but 2 using filters to enable grid view

### 5.6 Action Bar — Flow Integration

```
┌──────────────────────────────────────────────────────────────────┐
│  ☐ Select All Filtered (36)                                      │
│                                                                  │
│  [Load Selected (3) → Flow]   [Load All Filtered (36) → Flow]  │
│  [Export Filtered as CSV]                                        │
└──────────────────────────────────────────────────────────────────┘
```

**Two selection mechanisms** (both available):
1. **Checkboxes** — manual selection of individual files
2. **Filter-as-selection** — "Load All Filtered" uses the current filter state

Both produce a list of @tag paths that the flow system will consume:
```json
["@current_sweep/run001", "@current_sweep/run003", "@current_sweep/run005"]
```

---

## 6. File Naming Convention

### 6.1 Pattern

```
{batch_tag}/run{NNN}
```

Where:
- `{batch_tag}` = the batch folder's @tag (e.g., `current_sweep`)
- `{NNN}` = zero-padded run number (width based on total: 3 digits for ≤999, 4 for ≥1000)

### 6.2 Examples

```
@current_sweep/run001    (I_AC=500, s=0.05)
@current_sweep/run002    (I_AC=500, s=0.07)
@current_sweep/run066    (I_AC=1500, s=0.15)

@route_scan/run001       (lat=50.5000, lng=-1.2000)
@route_scan/run050       (lat=51.5000, lng=-0.5000)
```

### 6.3 Display Name in UI

The `name` field stored in `project_files` uses a human-readable format:
```
Run 001: I_AC=500, s=0.05
Run 002: I_AC=500, s=0.07
```

For location mode:
```
Run 001: lat=50.5000, lng=-1.2000
Run 002: lat=50.5102, lng=-1.1918
```

### 6.4 Parameter Ordering

Swept parameters appear in the order defined during wizard Step 3 (which matches the `sort_order` in `batch_sweep_axes`).

---

## 7. Backend API

### 7.1 Endpoints

```
# Batch folder CRUD
POST   /api/local-projects/{pid}/batches
       Body: { name, tag, parent_file_id, batch_mode, sweep_config, location_config? }
       Returns: BatchFolder (status: "generating")
       Side effect: Generates all files asynchronously

GET    /api/local-projects/{pid}/batches
       Returns: BatchFolder[] (metadata only)

GET    /api/local-projects/{pid}/batches/{bid}
       Returns: BatchFolder with full sweep_config + sweep_axes

DELETE /api/local-projects/{pid}/batches/{bid}
       Deletes batch folder + all generated files (CASCADE)

# Batch run queries
GET    /api/local-projects/{pid}/batches/{bid}/runs
       Query: ?page=1&per_page=50&sort=run_number&order=asc
       Returns: { runs: BatchRun[], total, page }

POST   /api/local-projects/{pid}/batches/{bid}/runs/filter
       Body: { filters: [{ key, min?, max?, exact? }] }
       Returns: { runs: BatchRun[], total, distinct_remaining }

# Batch run selection (for flow loading)
POST   /api/local-projects/{pid}/batches/{bid}/runs/select
       Body: { file_ids: string[] } OR { filter: FilterSpec }
       Returns: { tag_paths: string[], count: number }
```

### 7.2 File Generation Process

```python
async def generate_batch_files(batch: BatchFolder):
    """Generate all parameter files for a batch."""
    # 1. Load base params from snapshot
    base = json.loads(batch.base_params)

    # 2. Generate cartesian product of sweep values
    axes = get_sweep_axes(batch.id)
    combinations = cartesian_product([axis.values for axis in axes])

    # 3. Create each file
    for run_num, combo in enumerate(combinations, 1):
        params = {**base}  # copy base (immutable pattern)
        swept = {}
        for axis, value in zip(axes, combo):
            params[axis.param_key] = str(value)
            swept[axis.param_key] = value

        # Create project_file record
        file_id = create_file(
            project_id=batch.project_id,
            category="cable",
            sub_type=batch.cable_model_type,
            name=format_run_name(run_num, swept),
            tag=f"{batch.tag}/run{run_num:03d}",
            file_data={"params": params, "magnetic": batch.batch_mode == "magnetic"},
            batch_folder_id=batch.id,
            batch_run_number=run_num,
        )

        # Insert swept param values for filtering
        for key, value in swept.items():
            insert_run_parameter(file_id, batch.id, key, value)

    # 4. Update batch status
    update_batch_status(batch.id, "ready")
```

### 7.3 DC Bipole Location Mode Generation

```python
async def generate_location_batch(batch: BatchFolder, location_config: LocationConfig):
    """Generate files along a transect line with WMM lookups."""
    # 1. Interpolate waypoints
    points = interpolate_transect(
        waypoints=location_config.waypoints,
        total_points=location_config.total_points,
        method=location_config.interpolation,
    )

    # 2. WMM lookup for each point
    for run_num, point in enumerate(points, 1):
        wmm = lookup_wmm(point.lat, point.lng)

        params = {**json.loads(batch.base_params)}
        params["B_earth_X"] = str(wmm.x)
        params["B_earth_Y"] = str(wmm.y)
        params["B_earth_Z"] = str(wmm.z)

        swept = {"lat": point.lat, "lng": point.lng}
        # ... create file same as above
```

---

## 8. Component Architecture

### 8.1 File Tree

```
frontend/src/components/batch/
  batch-wizard.tsx              ← Creation wizard (4-step flow)
  batch-wizard-step-name.tsx    ← Step 1: Name + @tag
  batch-wizard-step-type.tsx    ← Step 2: Magnetic toggle / Mode selection
  batch-wizard-step-sweeps.tsx  ← Step 3: Parameter range configuration
  batch-wizard-step-review.tsx  ← Step 4: Review + generate
  batch-explorer.tsx            ← Main explorer container
  batch-summary-bar.tsx         ← Sweep config stat cards
  batch-filter-panel.tsx        ← Range sliders + progressive narrowing
  batch-results-table.tsx       ← Sortable, paginated table
  batch-grid-view.tsx           ← 2D heatmap matrix
  batch-action-bar.tsx          ← Select, load-to-flow, export
  dual-range-slider.tsx         ← Reusable dual-thumb slider
  sweep-param-row.tsx           ← Single parameter sweep config row

frontend/src/hooks/
  use-batch-filter.ts           ← Filter logic, distinct remaining values
  use-batch-data.ts             ← Load batch metadata + run index

frontend/src/lib/
  batch-files.ts                ← Batch CRUD API functions
  sweep-utils.ts                ← Cartesian product, combo counting, size estimation
```

### 8.2 File Size Targets

| File | Target LOC |
|------|-----------|
| batch-wizard.tsx | ~200 (orchestrator) |
| Each wizard step | ~150–250 |
| batch-explorer.tsx | ~200 (orchestrator) |
| batch-filter-panel.tsx | ~250 |
| batch-results-table.tsx | ~200 |
| batch-grid-view.tsx | ~200 |
| dual-range-slider.tsx | ~150 |
| use-batch-filter.ts | ~100 |
| sweep-utils.ts | ~80 |

---

## 9. Size Estimation Formula

Shown in wizard Step 3 and Step 4:

```
estimated_bytes = total_runs × avg_file_size_per_type
```

| Type | Avg file size | Notes |
|------|--------------|-------|
| HVAC Non-Magnetic | ~10 KB | 9 core params + metadata |
| HVAC Magnetic | ~14 KB | 18 params + metadata |
| DC Bipole Cable Mode | ~11 KB | 13 params + metadata |
| DC Bipole Location Mode | ~12 KB | 13 params + WMM data |

Display: `"66 files · ~0.8 MB"` (rounded to 1 decimal)

---

## 10. Constraints & Limits

| Constraint | Value | Rationale |
|-----------|-------|-----------|
| Max files per batch | 500 | Performance + storage |
| Max swept params (HVAC) | All 9 core + 9 magnetic | No restrictions |
| Max swept params (DC cable) | All 7 cable params | No restrictions |
| Max location points | 500 | Same as file cap |
| Max waypoints (location) | 20 | Practical limit |
| @tag max length | 50 chars | Reasonable for flow references |
| @tag format | `[a-z0-9_]+` | Lowercase, no spaces |
| @tag uniqueness | Per project | Enforced at DB level |
| Min step size | > 0 | Prevents infinite loops |

---

## 11. Open Items

- [ ] Flow integration API design (future spec — how flows consume @tag paths)
- [ ] Batch deletion confirmation UX (cascading delete warning)
- [ ] Batch re-generation (edit sweep config after creation?)
- [ ] Progress indicator during file generation (for large batches)
