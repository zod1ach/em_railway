"""3D Cable route calculation endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
from typing import List
import numpy as np
from datetime import datetime
from .plot_helpers import line_plot

router = APIRouter()

try:
    from pygeomag import GeoMag
    WMM_AVAILABLE = True
except ImportError:
    WMM_AVAILABLE = False


class Cable3DRequest(BaseModel):
    route_coords: List[List[float]]  # [[lon, lat], ...]
    r_DC: float = Field(0.060)
    cable_angle: float = Field(15.119)
    cable_slope: float = Field(0)
    I_DC: float = Field(1000)
    step_size: float = Field(100, description="metres between sample points")
    cross_radius: float = Field(2.0, description="cross-section radius (m)")
    n_radial: int = Field(50)
    n_angular: int = Field(36)
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


@router.post("/calculate")
def calculate(req: Cable3DRequest):
    if len(req.route_coords) < 2:
        return {"status": "error", "message": "Need at least 2 route points"}

    mu0 = 4 * np.pi * 1e-7
    ca = np.deg2rad(req.cable_angle)
    cs = np.deg2rad(req.cable_slope)
    dpi = min(max(req.dpi, 72), 600)

    coords = np.array(req.route_coords)
    # Interpolate route to step_size spacing (approximate, in degrees)
    diffs = np.diff(coords, axis=0)
    seg_lens = np.sqrt(np.sum(diffs**2, axis=1)) * 111000  # rough m
    cum = np.concatenate([[0], np.cumsum(seg_lens)])
    total_m = cum[-1]
    n_steps = max(int(total_m / req.step_size), 2)
    sample_d = np.linspace(0, cum[-1], n_steps)
    lons = np.interp(sample_d, cum, coords[:, 0])
    lats = np.interp(sample_d, cum, coords[:, 1])

    gm = GeoMag() if WMM_AVAILABLE else None
    dec = _dec_year(req.date)

    results = []
    for i, (lon, lat) in enumerate(zip(lons, lats)):
        # Earth field
        if gm:
            m = gm.calculate(float(lat), float(lon), 0, dec)
            Bx, By, Bz = m.x * 1e-9, m.y * 1e-9, m.z * 1e-9
        else:
            Bx, By, Bz = 9578e-9, 2588e-9, 53601e-9

        x_hat = np.array([-np.sin(ca), np.cos(ca), 0])
        y_hat = np.array([-np.cos(ca)*np.sin(cs), -np.sin(ca)*np.sin(cs), -np.cos(cs)])
        z_hat = np.array([np.cos(ca)*np.cos(cs), np.sin(ca)*np.cos(cs), -np.sin(cs)])
        Be = np.array([Bx, By, Bz])
        Bcx, Bcy, Bcz = x_hat @ Be, y_hat @ Be, z_hat @ Be
        B_earth = np.linalg.norm(Be)

        # Cross-section grid
        r_cs = np.linspace(req.r_DC * 1.1, req.cross_radius, req.n_radial)
        th_cs = np.linspace(0, 2 * np.pi, req.n_angular)
        RR, TH = np.meshgrid(r_cs, th_cs)
        XX = RR * np.cos(TH)
        YY = RR * np.sin(TH)

        r1 = np.sqrt((XX + req.r_DC)**2 + YY**2)
        r2 = np.sqrt((XX - req.r_DC)**2 + YY**2)

        Bfx = (mu0 * req.I_DC / (2 * np.pi)) * (-YY / r1**2 + YY / r2**2)
        Bfy = (mu0 * req.I_DC / (2 * np.pi)) * ((XX + req.r_DC) / r1**2 - (XX - req.r_DC) / r2**2)

        Btx = Bfx + Bcx
        Bty = Bfy + Bcy
        Bt = np.sqrt(Btx**2 + Bty**2 + Bcz**2)
        max_pert = float(np.max(Bt / B_earth))
        max_cable = float(np.max(np.sqrt(Bfx**2 + Bfy**2)) * 1e6)

        results.append({
            "lon": float(lon), "lat": float(lat),
            "distance_m": float(sample_d[i]),
            "max_perturbation": max_pert,
            "max_cable_field_uT": max_cable,
            "earth_field_nT": float(B_earth * 1e9),
        })

    dists = [r["distance_m"] / 1000 for r in results]
    perts = [r["max_perturbation"] for r in results]
    fields = [r["max_cable_field_uT"] for r in results]

    plots = {
        "perturbation_along_route": line_plot(dists, perts,
            "Max Perturbation along Route", "Distance (km)",
            "B\u209c\u2092\u209c\u2090\u2097 / B\u2091\u2090\u2093\u209c\u2095",
            color="#ef4444", dpi=dpi),
        "cable_field_along_route": line_plot(dists, fields,
            "Max Cable |B| along Route", "Distance (km)",
            "|B\u209c\u2090\u2097\u2091| (\u00b5T)", dpi=dpi),
    }

    return {"status": "success", "plots": plots, "points": results, "total_distance_km": float(total_m / 1000)}
