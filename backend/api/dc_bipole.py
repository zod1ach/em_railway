"""DC Bipole calculation endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
import numpy as np
from datetime import datetime
from .plot_helpers import surface_plot

router = APIRouter()

try:
    from pygeomag import GeoMag
    WMM_AVAILABLE = True
except ImportError:
    WMM_AVAILABLE = False


class DCBipoleParams(BaseModel):
    r_DC: float = Field(0.060)
    cable_angle: float = Field(15.119, description="degrees")
    cable_slope: float = Field(0, description="degrees")
    I_DC: float = Field(1000)
    B_earth_X: float = Field(9578, description="nT")
    B_earth_Y: float = Field(2588, description="nT")
    B_earth_Z: float = Field(53601, description="nT")
    grid_size: int = Field(400)
    x_min: float = Field(-1, description="X-axis min (m)")
    x_max: float = Field(1, description="X-axis max (m)")
    y_min: float = Field(-1, description="Y-axis min (m)")
    y_max: float = Field(1, description="Y-axis max (m)")
    dpi: int = Field(150, description="Plot DPI (72-600)")


class WMMRequest(BaseModel):
    lat: float
    lon: float
    date: str = ""  # DD/MM/YYYY


@router.post("/calculate")
def calculate(p: DCBipoleParams):
    mu0 = 4 * np.pi * 1e-7
    ca = np.deg2rad(p.cable_angle)
    cs = np.deg2rad(p.cable_slope)

    Bx = p.B_earth_X * 1e-9
    By = p.B_earth_Y * 1e-9
    Bz = p.B_earth_Z * 1e-9

    x_hat = np.array([-np.sin(ca), np.cos(ca), 0])
    y_hat = np.array([-np.cos(ca) * np.sin(cs), -np.sin(ca) * np.sin(cs), -np.cos(cs)])
    z_hat = np.array([np.cos(ca) * np.cos(cs), np.sin(ca) * np.cos(cs), -np.sin(cs)])
    Be = np.array([Bx, By, Bz])
    Bcx, Bcy, Bcz = x_hat @ Be, y_hat @ Be, z_hat @ Be
    B_earth = np.linalg.norm(Be)

    dpi = min(max(p.dpi, 72), 600)
    gs = min(p.grid_size, 1200)
    x = np.linspace(p.x_min, p.x_max, gs)
    y = np.linspace(p.y_min, p.y_max, gs)
    X, Y = np.meshgrid(x, y)

    r1 = np.sqrt((X + p.r_DC)**2 + Y**2)
    r2 = np.sqrt((X - p.r_DC)**2 + Y**2)

    Bfx = (mu0 * p.I_DC / (2 * np.pi)) * (-Y / r1**2 - (-Y) / r2**2)
    Bfy = (mu0 * p.I_DC / (2 * np.pi)) * ((X + p.r_DC) / r1**2 - (X - p.r_DC) / r2**2)
    Bnorm_bi = np.sqrt(Bfx**2 + Bfy**2)

    Bxp = Bfx + Bcx
    Byp = Bfy + Bcy
    Bnorm_per = np.sqrt(Bxp**2 + Byp**2 + Bcz**2)
    pert_log = np.log10(Bnorm_per / B_earth)

    r_mono = np.sqrt(X**2 + Y**2)
    Bmx = (mu0 * p.I_DC / (2 * np.pi)) * (-Y / r_mono**2)
    Bmy = (mu0 * p.I_DC / (2 * np.pi)) * (X / r_mono**2)
    Bnorm_mono = np.sqrt(Bmx**2 + Bmy**2)

    mask_bi = (r1 < p.r_DC) | (r2 < p.r_DC)
    mask_mono = r_mono < p.r_DC

    Bnorm_bi_uT = Bnorm_bi.copy() * 1e6
    Bnorm_bi_uT[mask_bi] = np.nan
    pert_log[mask_bi] = np.nan
    Bnorm_mono_uT = Bnorm_mono.copy() * 1e6
    Bnorm_mono_uT[mask_mono] = np.nan

    # Two conductor circles for DC bipole
    bipole_shapes = [
        {"type": "circle", "cx": float(-p.r_DC), "cy": 0.0, "r": float(p.r_DC * 0.5)},
        {"type": "circle", "cx": float(p.r_DC),  "cy": 0.0, "r": float(p.r_DC * 0.5)},
    ]
    plots = {
        "bipole_field": surface_plot(X, Y, Bnorm_bi_uT,
            "DC Bipole |B|", "x (m)", "y (m)",
            "|B| (\u00b5T)", dpi=dpi, shapes=bipole_shapes),
        "monopole_field": surface_plot(X, Y, Bnorm_mono_uT,
            "DC Monopole |B|", "x (m)", "y (m)",
            "|B| (\u00b5T)", dpi=dpi),
    }

    # Perturbation plot (diverging cmap)
    plots["perturbation"] = surface_plot(X, Y, pert_log,
        "Earth Field Perturbation", "x (m)", "y (m)",
        "log\u2081\u2080(B\u209c\u2092\u209c / B\u2091\u2090\u2093\u209c\u2095)",
        cmap="RdBu_r", dpi=dpi, shapes=bipole_shapes)

    return {
        "status": "success",
        "plots": plots,
        "results": {
            "max_bipole_uT": float(np.nanmax(Bnorm_bi_uT)),
            "min_bipole_uT": float(np.nanmin(Bnorm_bi_uT)),
            "max_monopole_uT": float(np.nanmax(Bnorm_mono_uT)),
            "min_monopole_uT": float(np.nanmin(Bnorm_mono_uT)),
            "earth_field_nT": float(B_earth * 1e9),
        },
    }


@router.post("/wmm-lookup")
def wmm_lookup(req: WMMRequest):
    if not WMM_AVAILABLE:
        return {"status": "error", "message": "pygeomag not installed on server"}
    try:
        if req.date:
            parts = req.date.split("/")
            dt = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
        else:
            dt = datetime.now()
        days = 366 if dt.year % 4 == 0 and (dt.year % 100 != 0 or dt.year % 400 == 0) else 365
        dec_year = dt.year + (dt.timetuple().tm_yday - 1) / days
        mag = GeoMag().calculate(req.lat, req.lon, 0, dec_year)
        return {"status": "success", "Bx": round(mag.x, 2), "By": round(mag.y, 2), "Bz": round(mag.z, 2)}
    except Exception as e:
        return {"status": "error", "message": str(e)}
