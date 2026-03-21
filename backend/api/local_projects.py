"""
Local project storage — SQLite-backed REST API.

Projects persist on-disk regardless of which browser the user opens.
Database file: backend/local_projects.db
"""

import sqlite3
import uuid
import json
from datetime import datetime, timezone
from pathlib import Path
from contextlib import contextmanager

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

router = APIRouter()

DB_PATH = Path(__file__).resolve().parent.parent / "local_projects.db"


# ── DB helpers ──────────────────────────────────────────────────────

@contextmanager
def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS project_data (
                project_id TEXT PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
                hvac_params TEXT,
                dc_params TEXT,
                wmm_params TEXT,
                cable_3d_params TEXT,
                updated_at TEXT NOT NULL
            );
        """)


init_db()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_project(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "description": row["description"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def row_to_project_data(row: sqlite3.Row) -> dict:
    return {
        "project_id": row["project_id"],
        "hvac_params": json.loads(row["hvac_params"]) if row["hvac_params"] else None,
        "dc_params": json.loads(row["dc_params"]) if row["dc_params"] else None,
        "wmm_params": json.loads(row["wmm_params"]) if row["wmm_params"] else None,
        "cable_3d_params": json.loads(row["cable_3d_params"]) if row["cable_3d_params"] else None,
        "updated_at": row["updated_at"],
    }


# ── Pydantic models ────────────────────────────────────────────────

class CreateProjectBody(BaseModel):
    name: str
    description: str = ""


class UpdateProjectBody(BaseModel):
    name: str | None = None
    description: str | None = None


class UpdateProjectDataBody(BaseModel):
    hvac_params: dict | None = None
    dc_params: dict | None = None
    wmm_params: dict | None = None
    cable_3d_params: dict | None = None


class ImportProjectBody(BaseModel):
    version: int = 1
    project: dict
    data: dict


# ── Routes: Projects ───────────────────────────────────────────────

@router.get("/")
def list_projects():
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM projects ORDER BY created_at DESC"
        ).fetchall()
    return [row_to_project(r) for r in rows]


@router.post("/", status_code=201)
def create_project(body: CreateProjectBody):
    project_id = str(uuid.uuid4())
    ts = now_iso()
    with get_db() as conn:
        conn.execute(
            "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (project_id, body.name, body.description or None, ts, ts),
        )
        conn.execute(
            "INSERT INTO project_data (project_id, updated_at) VALUES (?, ?)",
            (project_id, ts),
        )
    return {
        "id": project_id,
        "name": body.name,
        "description": body.description or None,
        "created_at": ts,
        "updated_at": ts,
    }


@router.get("/{project_id}")
def get_project(project_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Project not found")
    return row_to_project(row)


@router.patch("/{project_id}")
def update_project(project_id: str, body: UpdateProjectBody):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Project not found")
        updates = {}
        if body.name is not None:
            updates["name"] = body.name
        if body.description is not None:
            updates["description"] = body.description
        if not updates:
            return row_to_project(row)
        updates["updated_at"] = now_iso()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE projects SET {set_clause} WHERE id = ?",
            (*updates.values(), project_id),
        )
        updated = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
    return row_to_project(updated)


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT id FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Project not found")
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    return None


@router.get("/count/total")
def count_projects():
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as cnt FROM projects").fetchone()
    return {"count": row["cnt"]}


# ── Routes: Project Data ───────────────────────────────────────────

@router.get("/{project_id}/data")
def get_project_data(project_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM project_data WHERE project_id = ?", (project_id,)).fetchone()
    if not row:
        raise HTTPException(404, "Project data not found")
    return row_to_project_data(row)


@router.patch("/{project_id}/data")
def update_project_data(project_id: str, body: UpdateProjectDataBody):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM project_data WHERE project_id = ?", (project_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Project data not found")
        updates = {"updated_at": now_iso()}
        if body.hvac_params is not None:
            updates["hvac_params"] = json.dumps(body.hvac_params)
        if body.dc_params is not None:
            updates["dc_params"] = json.dumps(body.dc_params)
        if body.wmm_params is not None:
            updates["wmm_params"] = json.dumps(body.wmm_params)
        if body.cable_3d_params is not None:
            updates["cable_3d_params"] = json.dumps(body.cable_3d_params)
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(
            f"UPDATE project_data SET {set_clause} WHERE project_id = ?",
            (*updates.values(), project_id),
        )
        updated = conn.execute("SELECT * FROM project_data WHERE project_id = ?", (project_id,)).fetchone()
    return row_to_project_data(updated)


# ── Routes: Export / Import ────────────────────────────────────────

@router.get("/{project_id}/export")
def export_project(project_id: str):
    with get_db() as conn:
        proj = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        if not proj:
            raise HTTPException(404, "Project not found")
        data = conn.execute("SELECT * FROM project_data WHERE project_id = ?", (project_id,)).fetchone()
    return {
        "version": 1,
        "project": row_to_project(proj),
        "data": row_to_project_data(data) if data else {},
        "exported_at": now_iso(),
    }


@router.post("/import", status_code=201)
def import_project(body: ImportProjectBody):
    if body.version != 1:
        raise HTTPException(400, "Unsupported export version")
    project_id = str(uuid.uuid4())
    ts = now_iso()
    proj = body.project
    data = body.data
    with get_db() as conn:
        conn.execute(
            "INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
            (project_id, proj.get("name", "Imported"), proj.get("description"), proj.get("created_at", ts), ts),
        )
        conn.execute(
            "INSERT INTO project_data (project_id, hvac_params, dc_params, wmm_params, cable_3d_params, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            (
                project_id,
                json.dumps(data.get("hvac_params")) if data.get("hvac_params") else None,
                json.dumps(data.get("dc_params")) if data.get("dc_params") else None,
                json.dumps(data.get("wmm_params")) if data.get("wmm_params") else None,
                json.dumps(data.get("cable_3d_params")) if data.get("cable_3d_params") else None,
                ts,
            ),
        )
    return {"id": project_id, "name": proj.get("name", "Imported"), "created_at": ts}


@router.get("/{project_id}/size")
def project_size(project_id: str):
    with get_db() as conn:
        row = conn.execute("SELECT * FROM project_data WHERE project_id = ?", (project_id,)).fetchone()
    if not row:
        return {"size_bytes": 0}
    size = len(json.dumps(row_to_project_data(row)).encode())
    return {"size_bytes": size}
