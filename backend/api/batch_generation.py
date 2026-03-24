"""
Batch file generation logic.
Generates parameter files by computing cartesian product of sweep values
or interpolating location transects with WMM lookups.
"""

import json
import sqlite3
import math
import uuid
import re
import calendar
from datetime import datetime, timezone, date, timedelta
import numpy as np
from itertools import product as cartesian_product
from typing import Any


def _parse_ddmmyyyy(s: str) -> date | None:
    """Parse DD/MM/YYYY to a date object."""
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", s)
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
    except ValueError:
        return None


def _days_in_month(year: int, month: int) -> int:
    """Return number of days in a given month."""
    return calendar.monthrange(year, month)[1]


def _date_str_to_decimal(date_str: str) -> float | None:
    """Convert DD/MM/YYYY to decimal year for pygeomag."""
    d = _parse_ddmmyyyy(date_str)
    if not d:
        return None
    year_start = date(d.year, 1, 1)
    year_end = date(d.year + 1, 1, 1)
    fraction = (d - year_start).days / (year_end - year_start).days
    return d.year + fraction


def expand_dates(date_sweep: dict[str, Any] | None) -> list[str]:
    """Expand date sweep config into a list of DD/MM/YYYY date strings."""
    if not date_sweep:
        return [""]

    mode = date_sweep.get("mode", "single")
    start_str = date_sweep.get("start_date", "")

    if not start_str:
        return [""]

    start = _parse_ddmmyyyy(start_str)
    if not start:
        return [start_str]

    if mode == "single":
        return [start_str]

    if mode == "daily":
        end_str = date_sweep.get("end_date", "")
        end = _parse_ddmmyyyy(end_str)
        if not end or end < start:
            return [start_str]
        dates = []
        current = start
        while current <= end:
            dates.append(current.strftime("%d/%m/%Y"))
            current += timedelta(days=1)
        return dates

    if mode == "monthly":
        num_months = max(1, date_sweep.get("num_months", 1))
        dates = []
        for i in range(num_months):
            year = start.year + (start.month - 1 + i) // 12
            month = (start.month - 1 + i) % 12 + 1
            day = min(start.day, _days_in_month(year, month))
            d = date(year, month, day)
            dates.append(d.strftime("%d/%m/%Y"))
        return dates

    return [start_str]


def generate_batch_files(
    conn: sqlite3.Connection,
    batch_id: str,
    project_id: str,
    batch_tag: str,
    cable_model_type: str,
    batch_mode: str,
    base_params: dict[str, str],
    sweep_parameters: list[Any],
):
    """Generate files from cartesian product of sweep parameter values."""
    # Build value lists from sweep params
    axes_values = [sp.values for sp in sweep_parameters]
    axes_keys = [sp.key for sp in sweep_parameters]

    if not axes_values:
        return

    combinations = list(cartesian_product(*axes_values))
    pad_width = max(3, len(str(len(combinations))))

    is_magnetic = batch_mode == "magnetic"

    file_rows = []
    param_rows = []

    for run_num, combo in enumerate(combinations, 1):
        # Build complete param set: base + swept overrides
        params = {**base_params}
        swept = {}
        for key, value in zip(axes_keys, combo):
            params[key] = str(value)
            swept[key] = value

        # Format run name
        swept_str = ", ".join(f"{k}={v}" for k, v in swept.items())
        run_name = f"Run {str(run_num).zfill(pad_width)}: {swept_str}"
        run_tag = f"{batch_tag}/run{str(run_num).zfill(pad_width)}"

        # File data JSON
        file_data = json.dumps({
            "name": run_name,
            "tag": run_tag,
            "magnetic": is_magnetic,
            "params": params,
        })

        file_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()

        file_rows.append((
            file_id, project_id, "cable", cable_model_type,
            run_name, file_data, batch_id, run_num, now, now,
        ))

        # Param index rows for filtering
        for key, value in swept.items():
            param_rows.append((file_id, batch_id, key, value))

    # Bulk insert files
    conn.executemany(
        """INSERT INTO project_files
           (id, project_id, category, sub_type, name, file_data,
            batch_folder_id, batch_run_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        file_rows,
    )

    # Bulk insert param index
    if param_rows:
        conn.executemany(
            """INSERT INTO batch_run_parameters
               (file_id, batch_id, param_key, param_value)
               VALUES (?, ?, ?, ?)""",
            param_rows,
        )


def generate_location_batch(
    conn: sqlite3.Connection,
    batch_id: str,
    project_id: str,
    batch_tag: str,
    cable_model_type: str,
    base_params: dict[str, str],
    location_config: dict[str, Any],
    is_magnetic: bool = False,
):
    """Generate files along a transect line with WMM lookups at each point × date."""
    waypoints = location_config.get("waypoints", [])
    total_points = location_config.get("total_points", 10)
    method = location_config.get("interpolation", "linear")

    if len(waypoints) < 2:
        return

    # Interpolate points along the transect
    points = _interpolate_transect(waypoints, total_points, method)

    # Expand dates from sweep config
    date_sweep = location_config.get("date_sweep", None)
    dates = expand_dates(date_sweep)
    multi_date = len(dates) > 1

    # Single GeoMag instance for all lookups (performance)
    from pygeomag import GeoMag
    geo = GeoMag()

    total = len(points) * len(dates)
    pad_width = max(3, len(str(total)))
    file_rows = []
    param_rows = []

    run_num = 0
    for wmm_date_str in dates:
        # Compute decimal year for this date
        wmm_decimal = _date_str_to_decimal(wmm_date_str) if wmm_date_str else None
        if wmm_decimal is None:
            # Fallback: use wmm_date from base_params
            wmm_decimal = _date_str_to_decimal(base_params.get("wmm_date", "")) or 2025.0

        for point in points:
            run_num += 1
            lat, lng = point["lat"], point["lng"]

            # WMM lookup for earth field components
            try:
                result = geo.calculate(
                    glat=lat, glon=lng, alt=0, time=wmm_decimal,
                    allow_date_outside_lifespan=True,
                )
                b_earth_x, b_earth_y, b_earth_z = result.x, result.y, result.z
            except Exception:
                b_earth_x, b_earth_y, b_earth_z = 9578.0, 2588.0, 53601.0

            # Build param set with WMM overrides
            params = {**base_params}
            params["B_earth_X"] = str(b_earth_x)
            params["B_earth_Y"] = str(b_earth_y)
            params["B_earth_Z"] = str(b_earth_z)
            effective_date = wmm_date_str if wmm_date_str else base_params.get("wmm_date", "")
            if effective_date:
                params["wmm_date"] = effective_date

            swept = {
                "lat": lat,
                "lng": lng,
                "wmm_date": effective_date,
                "B_EARTH_X": b_earth_x,
                "B_EARTH_Y": b_earth_y,
                "B_EARTH_Z": b_earth_z,
            }

            date_label = f"{effective_date}, " if multi_date else ""
            run_name = f"Run {str(run_num).zfill(pad_width)}: {date_label}lat={lat:.4f}, lng={lng:.4f}"
            run_tag = f"{batch_tag}/run{str(run_num).zfill(pad_width)}"

            file_data = json.dumps({
                "name": run_name,
                "tag": run_tag,
                "magnetic": is_magnetic,
                "params": params,
            })

            file_id = uuid.uuid4().hex
            now = datetime.now(timezone.utc).isoformat()

            file_rows.append((
                file_id, project_id, "cable", cable_model_type,
                run_name, file_data, batch_id, run_num, now, now,
            ))

            for key, value in swept.items():
                param_rows.append((file_id, batch_id, key, value))

    # Bulk insert
    conn.executemany(
        """INSERT INTO project_files
           (id, project_id, category, sub_type, name, file_data,
            batch_folder_id, batch_run_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        file_rows,
    )

    if param_rows:
        conn.executemany(
            """INSERT INTO batch_run_parameters
               (file_id, batch_id, param_key, param_value)
               VALUES (?, ?, ?, ?)""",
            param_rows,
        )


def _interpolate_transect(
    waypoints: list[dict[str, float]],
    total_points: int,
    method: str = "linear",
) -> list[dict[str, float]]:
    """Interpolate evenly-spaced points along a polyline of waypoints."""
    if len(waypoints) < 2 or total_points < 1:
        return []

    lats = [w["lat"] for w in waypoints]
    lngs = [w["lng"] for w in waypoints]

    # Cumulative distance along polyline
    dists = [0.0]
    for i in range(1, len(lats)):
        d = _haversine_km(lats[i - 1], lngs[i - 1], lats[i], lngs[i])
        dists.append(dists[-1] + d)

    total_dist = dists[-1]
    if total_dist == 0:
        return [{"lat": lats[0], "lng": lngs[0]}]

    # Evenly spaced sample distances
    sample_d = np.linspace(0, total_dist, total_points)

    # Interpolate
    interp_lats = np.interp(sample_d, dists, lats)
    interp_lngs = np.interp(sample_d, dists, lngs)

    return [
        {"lat": round(float(lat), 6), "lng": round(float(lng), 6)}
        for lat, lng in zip(interp_lats, interp_lngs)
    ]


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance between two points in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlng / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
