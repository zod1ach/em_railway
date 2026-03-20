"""WMM Geomagnetic calculation endpoint — grid and line modes."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List, Tuple
import numpy as np
from datetime import datetime
from .plot_helpers import surface_plot, line_plot

router = APIRouter()

try:
    from pygeomag import GeoMag
    WMM_AVAILABLE = True
except ImportError:
    WMM_AVAILABLE = False


class GridRequest(BaseModel):
    lon0: float
    lon1: float
    lat0: float
    lat1: float
    resolution: float = Field(0.5, description="degrees")
    date: str = ""  # DD/MM/YYYY
    dpi: int = Field(150, description="Plot DPI (72-600)")


class LineRequest(BaseModel):
    coords: List[List[float]]  # [[lon, lat], ...]
    n_points: int = Field(200, description="interpolation points")
    date: str = ""
    dpi: int = Field(150, description="Plot DPI (72-600)")


def _dec_year(date_str: str) -> float:
    if date_str:
        parts = date_str.split("/")
        dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
    else:
        dt = datetime.now()
    days = 366 if dt.year % 4 == 0 and (dt.year % 100 != 0 or dt.year % 400 == 0) else 365
    return dt.year + (dt.timetuple().tm_yday - 1) / days


@router.post("/grid")
def grid_calculate(req: GridRequest):
    if not WMM_AVAILABLE:
        return {"status": "error", "message": "pygeomag not installed"}
    dec = _dec_year(req.date)
    gm = GeoMag()
    dpi = min(max(req.dpi, 72), 600)

    lons = np.arange(req.lon0, req.lon1, req.resolution)
    lats = np.arange(req.lat0, req.lat1, req.resolution)
    LON, LAT = np.meshgrid(lons, lats)

    F = np.zeros_like(LON)
    H = np.zeros_like(LON)
    D = np.zeros_like(LON)
    Inc = np.zeros_like(LON)

    for i in range(LAT.shape[0]):
        for j in range(LAT.shape[1]):
            m = gm.calculate(float(LAT[i, j]), float(LON[i, j]), 0, dec)
            F[i, j] = m.f
            H[i, j] = m.h
            D[i, j] = m.d
            Inc[i, j] = m.i

    plots = {
        "total_intensity": surface_plot(LON, LAT, F,
            "Total Intensity F", "Longitude (\u00b0)", "Latitude (\u00b0)",
            "F (nT)", cmap="magma", dpi=dpi),
        "horizontal_intensity": surface_plot(LON, LAT, H,
            "Horizontal Intensity H", "Longitude (\u00b0)", "Latitude (\u00b0)",
            "H (nT)", dpi=dpi),
        "declination": surface_plot(LON, LAT, D,
            "Declination D", "Longitude (\u00b0)", "Latitude (\u00b0)",
            "D (\u00b0)", cmap="RdBu_r", dpi=dpi),
        "inclination": surface_plot(LON, LAT, Inc,
            "Inclination I", "Longitude (\u00b0)", "Latitude (\u00b0)",
            "I (\u00b0)", cmap="RdBu_r", dpi=dpi),
    }

    return {
        "status": "success",
        "plots": plots,
        "results": {
            "f_max": float(np.max(F)), "f_min": float(np.min(F)), "f_mean": float(np.mean(F)),
            "h_max": float(np.max(H)), "h_min": float(np.min(H)),
            "total_points": int(LON.size),
        },
    }


@router.post("/line")
def line_calculate(req: LineRequest):
    if not WMM_AVAILABLE:
        return {"status": "error", "message": "pygeomag not installed"}
    if len(req.coords) < 2:
        return {"status": "error", "message": "Need at least 2 points"}

    dec = _dec_year(req.date)
    gm = GeoMag()
    dpi = min(max(req.dpi, 72), 600)

    coords = np.array(req.coords)
    dists = np.concatenate([[0], np.cumsum(np.sqrt(np.sum(np.diff(coords, axis=0)**2, axis=1)))])
    total = dists[-1]
    sample_d = np.linspace(0, total, req.n_points)
    lons = np.interp(sample_d, dists, coords[:, 0])
    lats = np.interp(sample_d, dists, coords[:, 1])

    results = []
    F_arr, H_arr, X_arr, Y_arr, Z_arr, D_arr, I_arr = [], [], [], [], [], [], []
    for lon, lat in zip(lons, lats):
        m = gm.calculate(float(lat), float(lon), 0, dec)
        F_arr.append(m.f); H_arr.append(m.h)
        X_arr.append(m.x); Y_arr.append(m.y); Z_arr.append(m.z)
        D_arr.append(m.d); I_arr.append(m.i)
        results.append({"lon": float(lon), "lat": float(lat), "f": m.f, "h": m.h,
                         "x": m.x, "y": m.y, "z": m.z, "d": m.d, "i": m.i})

    dist_km = (sample_d / np.max(sample_d) * total * 111).tolist() if total > 0 else sample_d.tolist()

    plots = {
        "f_profile": line_plot(dist_km, F_arr,
            "Total Intensity F along Route", "Distance (km)", "F (nT)", dpi=dpi),
        "h_profile": line_plot(dist_km, H_arr,
            "Horizontal Intensity H", "Distance (km)", "H (nT)",
            color="#34d399", dpi=dpi),
        "d_profile": line_plot(dist_km, D_arr,
            "Declination D", "Distance (km)", "D (\u00b0)",
            color="#f59e0b", dpi=dpi),
    }

    return {"status": "success", "plots": plots, "points": results}
