"""
CRUD endpoints for project files (model file metadata).
Files belong to a local project and represent Cable (HVAC/DC), WMM, or Bathymetry models.
"""

import sqlite3
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from .local_projects import get_db

router = APIRouter()

class FileCreate(BaseModel):
    category: str
    sub_type: Optional[str] = None

class FileOut(BaseModel):
    id: str
    project_id: str
    category: str
    sub_type: Optional[str]
    name: str
    created_at: str
    updated_at: str

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

def _generate_name(conn: sqlite3.Connection, project_id: str, category: str, sub_type: Optional[str]) -> str:
    if category == "cable" and sub_type == "dc_bipole":
        prefix = "Cable DC Bipole"
    elif category == "cable" and sub_type == "hvac":
        prefix = "Cable HVAC"
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
    if body.category != "cable" and body.sub_type is not None:
        raise HTTPException(400, "sub_type only valid for cable category")

    with get_db() as conn:
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
