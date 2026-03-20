"""Shared helpers — return plot data for interactive Plotly frontend rendering."""
import numpy as np
from typing import List, Optional

# ── Line colours ──────────────────────────────────────────────────────────
ACCENT = "#CCFF00"

LINE_COLORS = {
    "primary":   ACCENT,
    "secondary": "#60a5fa",
    "tertiary":  "#f472b6",
    "warning":   "#fbbf24",
    "success":   "#34d399",
    "error":     "#ef4444",
}


def _downsample_grid(arr, max_size=500):
    """Downsample a 2D array if larger than max_size on any axis."""
    if arr.shape[0] <= max_size and arr.shape[1] <= max_size:
        return arr
    step_r = max(1, arr.shape[0] // max_size)
    step_c = max(1, arr.shape[1] // max_size)
    return arr[::step_r, ::step_c]


def _safe_list(arr):
    """Convert numpy array to nested list, replacing NaN/Inf with None."""
    a = np.array(arr, dtype=float)
    result = []
    for v in a.flat:
        if np.isnan(v) or np.isinf(v):
            result.append(None)
        else:
            result.append(float(v))
    if a.ndim == 2:
        rows, cols = a.shape
        return [result[i * cols:(i + 1) * cols] for i in range(rows)]
    return result


def _contour_levels(Z, n=15):
    """Generate evenly spaced contour levels from valid data."""
    zmin = float(np.nanmin(Z))
    zmax = float(np.nanmax(Z))
    if zmin == zmax:
        return []
    return np.linspace(zmin, zmax, n).tolist()


def _make_circle(cx: float, cy: float, r: float, n: int = 200) -> dict:
    """Return a circle shape descriptor for the frontend to render."""
    return {"type": "circle", "cx": float(cx), "cy": float(cy), "r": float(r)}


# ══════════════════════════════════════════════════════════════════════════

def surface_plot(X, Y, Z, title, xlabel, ylabel, zlabel,
                 cmap="viridis", dpi=300, levels=256,
                 shapes: Optional[List[dict]] = None) -> dict:
    """Return heatmap + contour data for Plotly rendering."""
    Xd = _downsample_grid(X)
    Yd = _downsample_grid(Y)
    Zd = _downsample_grid(np.where(np.isnan(Z), np.nan, Z))

    x_arr = Xd[0, :].tolist()
    y_arr = Yd[:, 0].tolist()
    z_data = _safe_list(Zd)
    levels = _contour_levels(Zd)

    zmin = float(np.nanmin(Zd)) if levels else None
    zmax = float(np.nanmax(Zd)) if levels else None

    return {
        "type": "heatmap",
        "x": x_arr,
        "y": y_arr,
        "z": z_data,
        "title": title,
        "xlabel": xlabel,
        "ylabel": ylabel,
        "zlabel": zlabel,
        "colorscale": cmap,
        "contour_levels": levels,
        "zmin": zmin,
        "zmax": zmax,
        "shapes": shapes or [],
    }


def line_plot(x, y, title, xlabel, ylabel,
              color=None, dpi=300, marker=False) -> dict:
    """Return line plot data dict."""
    if color is None:
        color = LINE_COLORS["primary"]
    x_list = np.array(x).tolist() if not isinstance(x, list) else x
    y_list = np.array(y).tolist() if not isinstance(y, list) else y

    return {
        "type": "line",
        "x": x_list,
        "y": y_list,
        "title": title,
        "xlabel": xlabel,
        "ylabel": ylabel,
        "color": color,
    }


def polar_line_plot(theta, r, title, ylabel,
                    color=None, dpi=300) -> dict:
    """Return azimuthal line data dict."""
    if color is None:
        color = LINE_COLORS["secondary"]
    theta_deg = np.degrees(np.array(theta)).tolist()
    r_list = np.array(r).tolist() if not isinstance(r, list) else r

    return {
        "type": "line",
        "x": theta_deg,
        "y": r_list,
        "title": title,
        "xlabel": "\u03b8 (\u00b0)",
        "ylabel": ylabel,
        "color": color,
    }


def multi_line_plot(datasets, title, xlabel, ylabel, dpi=300) -> dict:
    """Return multi-line data dict."""
    color_cycle = list(LINE_COLORS.values())
    series = []
    for i, ds in enumerate(datasets):
        series.append({
            "x": ds["x"],
            "y": ds["y"],
            "label": ds.get("label", f"Series {i + 1}"),
            "color": ds.get("color", color_cycle[i % len(color_cycle)]),
        })
    return {
        "type": "multi_line",
        "series": series,
        "title": title,
        "xlabel": xlabel,
        "ylabel": ylabel,
    }
