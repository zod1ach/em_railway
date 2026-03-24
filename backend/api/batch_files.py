"""
Batch mode endpoints — CRUD for batch folders, file generation, filtering.
Batch folders sit under a parent cable model file and contain generated parameter files.
"""

import json
import math
import re
import sqlite3
import uuid
from typing import Optional, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from .local_projects import get_db

router = APIRouter()


# ── Pydantic Models ──

_PARAM_KEY_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]{0,63}$")
_RESERVED_KEYS = frozenset({"tag", "magnetic", "name"})


class SweepParameterIn(BaseModel):
    key: str
    label: str
    unit: str = ""
    min: float
    max: float
    step: Optional[float] = None
    values: list[float] = Field(default=[], max_length=500)

    @field_validator("key")
    @classmethod
    def validate_key(cls, v: str) -> str:
        if not _PARAM_KEY_RE.match(v):
            raise ValueError("param key must be an identifier (letters, digits, underscores, max 64 chars)")
        if v in _RESERVED_KEYS:
            raise ValueError(f"param key '{v}' is reserved")
        return v

    @field_validator("values")
    @classmethod
    def no_non_finite(cls, v: list[float]) -> list[float]:
        if any(not math.isfinite(x) for x in v):
            raise ValueError("sweep values must be finite numbers (no inf/NaN)")
        return v


class DateSweepIn(BaseModel):
    mode: str = "single"   # "single" | "daily" | "monthly"
    start_date: str = ""   # DD/MM/YYYY
    end_date: str = ""     # DD/MM/YYYY (daily mode)
    num_months: int = 1    # monthly mode

    @field_validator("mode")
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("single", "daily", "monthly"):
            raise ValueError("date sweep mode must be 'single', 'daily', or 'monthly'")
        return v


class LocationConfigIn(BaseModel):
    waypoints: list[dict[str, float]] = Field(min_length=2, max_length=100)
    total_points: int = Field(ge=1, le=500)
    interpolation: str = "linear"
    date_sweep: Optional[DateSweepIn] = None

    @field_validator("interpolation")
    @classmethod
    def validate_interpolation(cls, v: str) -> str:
        if v not in ("linear",):
            raise ValueError("interpolation must be 'linear'")
        return v


class BatchCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    tag: str
    parent_file_id: str
    cable_model_type: str  # "hvac" | "dc_bipole"
    batch_mode: str  # "magnetic" | "non_magnetic" | "cable" | "location"
    sweep_parameters: list[SweepParameterIn] = Field(default=[], max_length=10)
    location_config: Optional[LocationConfigIn] = None

class FilterItem(BaseModel):
    key: str
    min: Optional[float] = None
    max: Optional[float] = None
    exact: Optional[float] = None

class FilterRequest(BaseModel):
    filters: list[FilterItem] = []
    page: int = 1
    per_page: int = 50
    sort: str = "run_number"
    order: str = "asc"

    @staticmethod
    def _clamp_per_page(v: int) -> int:
        return max(1, min(v, 500))

    def __init__(self, **data):
        super().__init__(**data)
        object.__setattr__(self, "per_page", self._clamp_per_page(self.per_page))

class SelectRequest(BaseModel):
    file_ids: list[str] = Field(default=[], max_length=500)


# ── Helpers ──

# Safe sort column lookup (prevents SQL injection)
_ALLOWED_SORTS = {
    "run_number": "pf.batch_run_number",
    "batch_run_number": "pf.batch_run_number",
    "calc_peak_b_field": "pf.calc_peak_b_field",
    "calc_peak_e_field": "pf.calc_peak_e_field",
    "created_at": "pf.created_at",
}


def _safe_sort_col(sort: str) -> str:
    return _ALLOWED_SORTS.get(sort, "pf.batch_run_number")


def _row_to_dict(row) -> dict:
    if not row:
        raise ValueError("Expected a database row, got None")
    return dict(row)


def _attach_params_to_files(conn: sqlite3.Connection, file_rows: list) -> list[dict]:
    """Attach swept param values to file rows using a single batch query (H1 fix)."""
    if not file_rows:
        return []

    files_by_id = {}
    for f in file_rows:
        fd = _row_to_dict(f)
        fd["params"] = {}
        file_data = json.loads(fd.get("file_data", "{}") or "{}")
        fd["tag_path"] = file_data.get("tag", "")
        files_by_id[fd["file_id"]] = fd

    # Single query for all param values
    placeholders = ",".join("?" for _ in files_by_id)
    params = conn.execute(
        f"""SELECT file_id, param_key, param_value
            FROM batch_run_parameters
            WHERE file_id IN ({placeholders})""",
        tuple(files_by_id.keys()),
    ).fetchall()

    for p in params:
        fid = p["file_id"]
        if fid in files_by_id:
            files_by_id[fid]["params"][p["param_key"]] = p["param_value"]

    # Preserve original order
    result = []
    for f in file_rows:
        fd = _row_to_dict(f)
        result.append(files_by_id[fd["file_id"]])
    return result


def _validate_tag(tag: str) -> bool:
    """Validate tag format: lowercase, alphanumeric + underscores, max 50 chars."""
    import re
    return bool(re.match(r'^[a-z0-9_]+$', tag)) and len(tag) <= 50


def _check_tag_unique(conn: sqlite3.Connection, project_id: str, tag: str):
    """Ensure tag is unique within the project (across batch_folders and project_files)."""
    existing = conn.execute(
        "SELECT id FROM batch_folders WHERE project_id = ? AND tag = ?",
        (project_id, tag),
    ).fetchone()
    if existing:
        raise HTTPException(409, f"Tag '@{tag}' already exists in this project")

    # Also check individual file tags stored in file_data JSON
    files = conn.execute(
        "SELECT id, file_data FROM project_files WHERE project_id = ?",
        (project_id,),
    ).fetchall()
    for f in files:
        raw = f["file_data"] if isinstance(f, sqlite3.Row) else f[1]
        data = json.loads(raw or "{}")
        if data.get("tag") == tag:
            raise HTTPException(409, f"Tag '@{tag}' already exists in this project")


# ── Endpoints ──

@router.post("/{project_id}/batches", status_code=201)
def create_batch(project_id: str, body: BatchCreate):
    """Create a batch folder and generate all parameter files."""
    if not _validate_tag(body.tag):
        raise HTTPException(400, "Tag must be lowercase alphanumeric + underscores, max 50 chars")

    if body.cable_model_type not in ("hvac", "dc_bipole"):
        raise HTTPException(400, "cable_model_type must be 'hvac' or 'dc_bipole'")

    if body.batch_mode not in ("magnetic", "non_magnetic", "cable", "location"):
        raise HTTPException(400, "batch_mode must be one of: magnetic, non_magnetic, cable, location")

    # M5 fix: validate location waypoint coordinates
    if body.location_config:
        for i, wp in enumerate(body.location_config.waypoints):
            lat, lng = wp.get("lat", 0), wp.get("lng", 0)
            if not (-90 <= lat <= 90):
                raise HTTPException(400, f"Waypoint {i+1}: latitude {lat} out of range [-90, 90]")
            if not (-180 <= lng <= 180):
                raise HTTPException(400, f"Waypoint {i+1}: longitude {lng} out of range [-180, 180]")

    with get_db() as conn:
        # Verify project exists
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(404, "Project not found")

        # Verify parent file exists
        parent = conn.execute(
            "SELECT id, file_data FROM project_files WHERE id = ? AND project_id = ?",
            (body.parent_file_id, project_id),
        ).fetchone()
        if not parent:
            raise HTTPException(404, "Parent file not found")

        # Check tag uniqueness
        _check_tag_unique(conn, project_id, body.tag)

        # Snapshot base params from parent
        parent_data = json.loads(
            (parent["file_data"] if isinstance(parent, sqlite3.Row) else parent[1]) or "{}"
        )
        base_params = parent_data.get("params", {})

        # Calculate total combinations
        if body.batch_mode == "location" and body.location_config:
            from .batch_generation import expand_dates
            dates = expand_dates(
                body.location_config.date_sweep.model_dump()
                if body.location_config.date_sweep else None
            )
            total_runs = body.location_config.total_points * len(dates)
        else:
            total_runs = 1
            for sp in body.sweep_parameters:
                total_runs *= len(sp.values) if sp.values else 0

        if total_runs > 500:
            raise HTTPException(400, f"Batch exceeds 500 file limit ({total_runs} files)")

        if total_runs == 0:
            raise HTTPException(400, "Batch would produce 0 files")

        # Estimate size
        size_map = {
            "magnetic": 14_000, "non_magnetic": 10_000,
            "cable": 11_000, "location": 12_000,
        }
        estimated_size = total_runs * size_map.get(body.batch_mode, 12_000)

        # Create batch folder (H3 fix: Python uuid instead of SQLite randomblob)
        batch_id = uuid.uuid4().hex
        sweep_config_json = json.dumps({
            "parameters": [sp.model_dump() for sp in body.sweep_parameters]
        })
        location_config_json = (
            json.dumps(body.location_config.model_dump())
            if body.location_config else None
        )

        try:
            conn.execute(
                """INSERT INTO batch_folders
                   (id, project_id, parent_file_id, name, tag, cable_model_type,
                    batch_mode, base_params, sweep_config, location_config,
                    total_runs, estimated_size_bytes, status)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generating')""",
                (batch_id, project_id, body.parent_file_id, body.name, body.tag,
                 body.cable_model_type, body.batch_mode,
                 json.dumps(base_params), sweep_config_json, location_config_json,
                 total_runs, estimated_size),
            )
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                raise HTTPException(409, f"Tag '@{body.tag}' already exists in this project")
            raise

        # Insert sweep axes
        for idx, sp in enumerate(body.sweep_parameters):
            conn.execute(
                """INSERT INTO batch_sweep_axes
                   (batch_id, param_key, param_label, unit, min_val, max_val,
                    step_val, values_json, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (batch_id, sp.key, sp.label, sp.unit, sp.min, sp.max,
                 sp.step, json.dumps(sp.values), idx),
            )

        # Generate files
        from .batch_generation import generate_batch_files, generate_location_batch

        if body.batch_mode == "location" and body.location_config:
            generate_location_batch(conn, batch_id, project_id, body.tag,
                                    body.cable_model_type, base_params,
                                    body.location_config.model_dump(),
                                    parent_data.get("magnetic", False))
            # Insert sweep axes for location mode columns
            loc_axes = [
                ("lat", "Latitude", "°", 0),
                ("lng", "Longitude", "°", 1),
                ("wmm_date", "WMM Date", "", 2),
                ("B_EARTH_X", "B_EARTH X", "nT", 3),
                ("B_EARTH_Y", "B_EARTH Y", "nT", 4),
                ("B_EARTH_Z", "B_EARTH Z", "nT", 5),
            ]
            for key, label, unit, order in loc_axes:
                conn.execute(
                    """INSERT INTO batch_sweep_axes
                       (batch_id, param_key, param_label, unit, min_val, max_val,
                        step_val, values_json, sort_order)
                       VALUES (?, ?, ?, ?, 0, 0, NULL, '[]', ?)""",
                    (batch_id, key, label, unit, order),
                )
        else:
            generate_batch_files(conn, batch_id, project_id, body.tag,
                                 body.cable_model_type, body.batch_mode,
                                 base_params, body.sweep_parameters)

        # Mark ready
        conn.execute("UPDATE batch_folders SET status = 'ready' WHERE id = ?", (batch_id,))
        conn.commit()

        row = conn.execute("SELECT * FROM batch_folders WHERE id = ?", (batch_id,)).fetchone()
        return _row_to_dict(row)


@router.get("/{project_id}/batches")
def list_batches(project_id: str):
    """List all batch folders for a project."""
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM batch_folders WHERE project_id = ? ORDER BY created_at ASC",
            (project_id,),
        ).fetchall()
        return [_row_to_dict(r) for r in rows]


@router.get("/{project_id}/batches/{batch_id}")
def get_batch(project_id: str, batch_id: str):
    """Get batch folder with sweep axes."""
    with get_db() as conn:
        batch = conn.execute(
            "SELECT * FROM batch_folders WHERE id = ? AND project_id = ?",
            (batch_id, project_id),
        ).fetchone()
        if not batch:
            raise HTTPException(404, "Batch not found")

        axes = conn.execute(
            "SELECT * FROM batch_sweep_axes WHERE batch_id = ? ORDER BY sort_order",
            (batch_id,),
        ).fetchall()

        result = _row_to_dict(batch)
        result["sweep_axes"] = [_row_to_dict(a) for a in axes]
        return result


@router.delete("/{project_id}/batches/{batch_id}", status_code=204)
def delete_batch(project_id: str, batch_id: str):
    """Delete batch folder and all generated files (CASCADE)."""
    with get_db() as conn:
        batch = conn.execute(
            "SELECT id FROM batch_folders WHERE id = ? AND project_id = ?",
            (batch_id, project_id),
        ).fetchone()
        if not batch:
            raise HTTPException(404, "Batch not found")

        # Delete child files first (batch_run_parameters CASCADE from file deletion)
        conn.execute(
            "DELETE FROM project_files WHERE batch_folder_id = ?",
            (batch_id,),
        )
        # Then delete the batch folder (sweep_axes CASCADE)
        conn.execute("DELETE FROM batch_folders WHERE id = ?", (batch_id,))
        conn.commit()


@router.get("/{project_id}/batches/{batch_id}/runs")
def list_runs(project_id: str, batch_id: str, page: int = 1, per_page: int = 50,
              sort: str = "batch_run_number", order: str = "asc"):
    """List batch runs with pagination."""
    with get_db() as conn:
        batch = conn.execute(
            "SELECT id FROM batch_folders WHERE id = ? AND project_id = ?",
            (batch_id, project_id),
        ).fetchone()
        if not batch:
            raise HTTPException(404, "Batch not found")

        sort_col = _safe_sort_col(sort)
        order_dir = "DESC" if order.lower() == "desc" else "ASC"

        total = conn.execute(
            "SELECT COUNT(*) FROM project_files WHERE batch_folder_id = ?",
            (batch_id,),
        ).fetchone()[0]

        offset = (page - 1) * per_page
        files = conn.execute(
            f"""SELECT pf.id as file_id, pf.batch_run_number, pf.name, pf.file_data,
                       pf.calc_peak_b_field, pf.calc_peak_e_field, pf.calc_status
                FROM project_files pf
                WHERE pf.batch_folder_id = ?
                ORDER BY {sort_col} {order_dir}
                LIMIT ? OFFSET ?""",
            (batch_id, per_page, offset),
        ).fetchall()

        # H1 fix: single JOIN query instead of N+1 per-file param lookups
        runs = _attach_params_to_files(conn, files)

        return {"runs": runs, "total": total, "page": page, "per_page": per_page}


@router.post("/{project_id}/batches/{batch_id}/runs/filter")
def filter_runs(project_id: str, batch_id: str, body: FilterRequest):
    """Filter batch runs with progressive narrowing."""
    with get_db() as conn:
        batch = conn.execute(
            "SELECT id FROM batch_folders WHERE id = ? AND project_id = ?",
            (batch_id, project_id),
        ).fetchone()
        if not batch:
            raise HTTPException(404, "Batch not found")

        # Get all file IDs in this batch
        all_files = conn.execute(
            "SELECT id FROM project_files WHERE batch_folder_id = ?",
            (batch_id,),
        ).fetchall()
        file_ids = {r["id"] for r in all_files}

        # Apply filters progressively
        for f in body.filters:
            if f.exact is not None:
                matching = conn.execute(
                    """SELECT file_id FROM batch_run_parameters
                       WHERE batch_id = ? AND param_key = ? AND param_value = ?""",
                    (batch_id, f.key, f.exact),
                ).fetchall()
            elif f.min is not None and f.max is not None:
                matching = conn.execute(
                    """SELECT file_id FROM batch_run_parameters
                       WHERE batch_id = ? AND param_key = ?
                       AND param_value >= ? AND param_value <= ?""",
                    (batch_id, f.key, f.min, f.max),
                ).fetchall()
            elif f.min is not None:
                matching = conn.execute(
                    """SELECT file_id FROM batch_run_parameters
                       WHERE batch_id = ? AND param_key = ? AND param_value >= ?""",
                    (batch_id, f.key, f.min),
                ).fetchall()
            elif f.max is not None:
                matching = conn.execute(
                    """SELECT file_id FROM batch_run_parameters
                       WHERE batch_id = ? AND param_key = ? AND param_value <= ?""",
                    (batch_id, f.key, f.max),
                ).fetchall()
            else:
                continue

            file_ids &= {r["file_id"] for r in matching}

        if not file_ids:
            return {"runs": [], "total": 0, "distinct_remaining": {}}

        # Convert set to sorted list for deterministic query ordering
        file_id_list = sorted(file_ids)

        # Get filtered runs with pagination
        placeholders = ",".join("?" for _ in file_id_list)
        order_dir = "DESC" if body.order.lower() == "desc" else "ASC"
        offset = (body.page - 1) * body.per_page

        files = conn.execute(
            f"""SELECT pf.id as file_id, pf.batch_run_number, pf.name, pf.file_data,
                       pf.calc_peak_b_field, pf.calc_peak_e_field, pf.calc_status
                FROM project_files pf
                WHERE pf.id IN ({placeholders})
                ORDER BY pf.batch_run_number {order_dir}
                LIMIT ? OFFSET ?""",
            (*file_id_list, body.per_page, offset),
        ).fetchall()

        # H1 fix: single JOIN query instead of N+1 per-file param lookups
        runs = _attach_params_to_files(conn, files)

        # Compute distinct remaining values for each sweep axis
        axes = conn.execute(
            "SELECT param_key FROM batch_sweep_axes WHERE batch_id = ? ORDER BY sort_order",
            (batch_id,),
        ).fetchall()

        distinct_remaining = {}
        for axis in axes:
            key = axis["param_key"]
            vals = conn.execute(
                f"""SELECT DISTINCT brp.param_value
                    FROM batch_run_parameters brp
                    WHERE brp.batch_id = ? AND brp.param_key = ?
                    AND brp.file_id IN ({placeholders})
                    ORDER BY brp.param_value""",
                (batch_id, key, *file_id_list),
            ).fetchall()
            distinct_remaining[key] = [v["param_value"] for v in vals]

        return {
            "runs": runs,
            "total": len(file_id_list),
            "page": body.page,
            "per_page": body.per_page,
            "distinct_remaining": distinct_remaining,
        }


@router.post("/{project_id}/batches/{batch_id}/runs/select")
def select_runs(project_id: str, batch_id: str, body: SelectRequest):
    """Select batch runs and return their @tag paths for flow loading."""
    with get_db() as conn:
        batch = conn.execute(
            "SELECT tag FROM batch_folders WHERE id = ? AND project_id = ?",
            (batch_id, project_id),
        ).fetchone()
        if not batch:
            raise HTTPException(404, "Batch not found")

        if body.file_ids:
            placeholders = ",".join("?" for _ in body.file_ids)
            files = conn.execute(
                f"""SELECT file_data FROM project_files
                    WHERE id IN ({placeholders}) AND batch_folder_id = ?""",
                (*body.file_ids, batch_id),
            ).fetchall()
        else:
            files = conn.execute(
                "SELECT file_data FROM project_files WHERE batch_folder_id = ?",
                (batch_id,),
            ).fetchall()

        tag_paths = []
        for f in files:
            raw = f["file_data"] if isinstance(f, sqlite3.Row) else f[0]
            data = json.loads(raw or "{}")
            tag_paths.append(data.get("tag", ""))

        return {"tag_paths": tag_paths, "count": len(tag_paths)}
