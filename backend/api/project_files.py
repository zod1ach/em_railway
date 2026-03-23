"""
CRUD endpoints for project files (model file metadata + parameter data).
Files belong to a local project and represent Cable (HVAC/DC), WMM, or Bathymetry models.
"""

import json
import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Any
from .local_projects import get_db

router = APIRouter()

class FileCreate(BaseModel):
    category: str
    sub_type: Optional[str] = None

class FileDataUpdate(BaseModel):
    name: Optional[str] = None
    tag: Optional[str] = None
    magnetic: Optional[bool] = None
    params: Optional[dict[str, Any]] = None

class FileOut(BaseModel):
    id: str
    project_id: str
    category: str
    sub_type: Optional[str]
    name: str
    created_at: str
    updated_at: str
    batch_folder_id: Optional[str] = None
    batch_run_number: Optional[int] = None

def init_project_files_table():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS project_files (
                id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                category TEXT NOT NULL CHECK (category IN ('cable', 'wmm', 'bathymetry')),
                sub_type TEXT CHECK (
                    (category = 'cable' AND sub_type IN ('hvac', 'dc_bipole'))
                    OR (category = 'wmm' AND (sub_type IN ('grid', 'line') OR sub_type IS NULL))
                    OR (category = 'bathymetry' AND sub_type IS NULL)
                ),
                name TEXT NOT NULL,
                file_data TEXT DEFAULT '{}',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
        """)
        # Migration: add file_data column if table already exists without it
        try:
            conn.execute("ALTER TABLE project_files ADD COLUMN file_data TEXT DEFAULT '{}'")
        except sqlite3.OperationalError:
            pass  # column already exists

init_project_files_table()

# Initialize batch tables (idempotent — safe on existing DBs)
from .batch_init import init_batch_tables
init_batch_tables()

def _generate_name(conn: sqlite3.Connection, project_id: str, category: str, sub_type: Optional[str]) -> str:
    if category == "cable" and sub_type == "dc_bipole":
        prefix = "Cable DC Bipole"
    elif category == "cable" and sub_type == "hvac":
        prefix = "Cable HVAC"
    elif category == "wmm" and sub_type == "grid":
        prefix = "WMM Grid"
    elif category == "wmm" and sub_type == "line":
        prefix = "WMM Line"
    elif category == "wmm":
        prefix = "WMM"
    else:
        prefix = "Bathymetry"

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

@router.get("/{project_id}/files", response_model=list[FileOut])
def list_files(project_id: str):
    with get_db() as conn:
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
    if body.category not in ("cable", "wmm", "bathymetry"):
        raise HTTPException(400, "Invalid category")
    if body.category == "cable" and body.sub_type not in ("hvac", "dc_bipole"):
        raise HTTPException(400, "Cable category requires sub_type: hvac or dc_bipole")
    if body.category == "wmm" and body.sub_type not in (None, "grid", "line"):
        raise HTTPException(400, "WMM sub_type must be grid or line")
    if body.category == "bathymetry" and body.sub_type is not None:
        raise HTTPException(400, "sub_type only valid for cable category")

    with get_db() as conn:
        proj = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(404, "Project not found")

        name = _generate_name(conn, project_id, body.category, body.sub_type)
        file_id = conn.execute("SELECT lower(hex(randomblob(16)))").fetchone()[0]
        now = conn.execute("SELECT datetime('now')").fetchone()[0]
        conn.execute(
            """INSERT INTO project_files (id, project_id, category, sub_type, name, file_data, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, '{}', ?, ?)""",
            (file_id, project_id, body.category, body.sub_type, name, now, now),
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

        # Cascade: delete batch folders under this file (and their child files)
        batch_folders = conn.execute(
            "SELECT id FROM batch_folders WHERE parent_file_id = ?",
            (file_id,),
        ).fetchall()
        for bf in batch_folders:
            # Delete batch child files first (they reference batch_folders via FK)
            conn.execute("DELETE FROM batch_run_parameters WHERE batch_id = ?", (bf["id"],))
            conn.execute("DELETE FROM project_files WHERE batch_folder_id = ?", (bf["id"],))
            conn.execute("DELETE FROM batch_sweep_axes WHERE batch_id = ?", (bf["id"],))
            conn.execute("DELETE FROM batch_folders WHERE id = ?", (bf["id"],))

        conn.execute("DELETE FROM project_files WHERE id = ?", (file_id,))
        conn.commit()

@router.get("/{project_id}/files/{file_id}/data")
def get_file_data(project_id: str, file_id: str):
    with get_db() as conn:
        row = conn.execute(
            "SELECT file_data FROM project_files WHERE id = ? AND project_id = ?",
            (file_id, project_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")
        raw = row["file_data"] if isinstance(row, sqlite3.Row) else row[0]
        return json.loads(raw or "{}")

@router.put("/{project_id}/files/{file_id}/data")
def update_file_data(project_id: str, file_id: str, body: FileDataUpdate):
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, file_data FROM project_files WHERE id = ? AND project_id = ?",
            (file_id, project_id),
        ).fetchone()
        if not row:
            raise HTTPException(404, "File not found")

        # Merge new data into existing
        existing = json.loads((row["file_data"] if isinstance(row, sqlite3.Row) else row[1]) or "{}")
        if body.name is not None:
            existing["name"] = body.name
        if body.tag is not None:
            existing["tag"] = body.tag
        if body.magnetic is not None:
            existing["magnetic"] = body.magnetic
        if body.params is not None:
            existing["params"] = body.params

        # Also update the file name in metadata if provided
        updates = ["file_data = ?", "updated_at = datetime('now')"]
        params_list: list = [json.dumps(existing)]
        if body.name is not None:
            updates.append("name = ?")
            params_list.append(body.name)
        params_list.append(file_id)

        conn.execute(
            f"UPDATE project_files SET {', '.join(updates)} WHERE id = ?",
            params_list,
        )
        conn.commit()
        return existing
