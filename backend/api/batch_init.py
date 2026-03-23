"""
Schema migration for batch mode tables.
Called from project_files.py init chain. Idempotent — safe to run on existing DBs.
"""

import sqlite3
from .local_projects import get_db


def init_batch_tables():
    """Create batch tables and add batch columns to project_files."""
    with get_db() as conn:
        # Use individual execute() calls instead of executescript()
        # to avoid implicit COMMIT of any open transaction (M4 fix)

        # C1 fix: parent_file_id uses ON DELETE RESTRICT (not CASCADE)
        # to break circular cascade. Deletion order: child files → batch folder → parent file.
        conn.execute("""
            CREATE TABLE IF NOT EXISTS batch_folders (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                parent_file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE RESTRICT,
                name TEXT NOT NULL,
                tag TEXT NOT NULL,
                cable_model_type TEXT NOT NULL CHECK (cable_model_type IN ('hvac', 'dc_bipole')),
                batch_mode TEXT CHECK (batch_mode IN ('magnetic', 'non_magnetic', 'cable', 'location')),
                base_params TEXT NOT NULL DEFAULT '{}',
                sweep_config TEXT NOT NULL DEFAULT '{}',
                location_config TEXT,
                total_runs INTEGER NOT NULL DEFAULT 0,
                estimated_size_bytes INTEGER DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'created'
                    CHECK (status IN ('created', 'generating', 'ready', 'error')),
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE(project_id, tag)
            )
        """)

        conn.execute("""
            CREATE TABLE IF NOT EXISTS batch_sweep_axes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                batch_id TEXT NOT NULL REFERENCES batch_folders(id) ON DELETE CASCADE,
                param_key TEXT NOT NULL,
                param_label TEXT NOT NULL,
                unit TEXT NOT NULL DEFAULT '',
                min_val REAL NOT NULL,
                max_val REAL NOT NULL,
                step_val REAL,
                values_json TEXT NOT NULL DEFAULT '[]',
                sort_order INTEGER NOT NULL DEFAULT 0
            )
        """)

        # L1 fix: UNIQUE constraint on (file_id, param_key) prevents duplicate param rows
        conn.execute("""
            CREATE TABLE IF NOT EXISTS batch_run_parameters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_id TEXT NOT NULL REFERENCES project_files(id) ON DELETE CASCADE,
                batch_id TEXT NOT NULL REFERENCES batch_folders(id) ON DELETE CASCADE,
                param_key TEXT NOT NULL,
                param_value REAL NOT NULL,
                UNIQUE(file_id, param_key)
            )
        """)

        # Indexes for query performance
        conn.execute("CREATE INDEX IF NOT EXISTS idx_brp_batch_param ON batch_run_parameters(batch_id, param_key, param_value)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_brp_file ON batch_run_parameters(file_id)")

        # H4 fix: explicit index on batch_folders.project_id
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bf_project ON batch_folders(project_id)")

        # M3 fix: index on batch_sweep_axes.batch_id
        conn.execute("CREATE INDEX IF NOT EXISTS idx_bsa_batch ON batch_sweep_axes(batch_id)")

        # Add batch columns to project_files (idempotent)
        _add_column(conn, "project_files", "batch_folder_id", "TEXT REFERENCES batch_folders(id) ON DELETE CASCADE")
        _add_column(conn, "project_files", "batch_run_number", "INTEGER")
        _add_column(conn, "project_files", "calc_peak_b_field", "REAL")
        _add_column(conn, "project_files", "calc_peak_e_field", "REAL")
        _add_column(conn, "project_files", "calc_status", "TEXT")

        # H5 fix: index on project_files.batch_folder_id
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pf_batch_folder ON project_files(batch_folder_id)")

        conn.commit()


def _add_column(conn: sqlite3.Connection, table: str, column: str, col_type: str):
    """Add a column to a table, skipping only if it already exists (C2 fix)."""
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
    except sqlite3.OperationalError as e:
        if "duplicate column name" not in str(e):
            raise  # re-raise genuine errors (disk full, locked DB, etc.)
