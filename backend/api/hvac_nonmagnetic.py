"""HVAC Non-Magnetic calculation endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
import numpy as np
from calculations.fields import B_three_helices, A_three_helices
from calculations.armour import sheath_reduction_factor
from .plot_helpers import surface_plot, line_plot, polar_line_plot

router = APIRouter()


class HvacNonmagParams(BaseModel):
    p_c: float = Field(2.750, description="Power core lay length (m)")
    R_h: float = Field(0.060391, description="Helix radius (m)")
    r_AC: float = Field(0.1225, description="Cable radius (m)")
    d_s: float = Field(0.0958, description="Sheath diameter (m)")
    R_s: float = Field(2398.15e-7, description="Sheath resistance (Ω/m)")
    f: float = Field(50, description="Frequency (Hz)")
    I_AC: float = Field(1000, description="Current (A)")
    N_calc: int = Field(10, description="Number of harmonics")
    s: float = Field(0.0892, description="Conductor spacing (m)")
    grid_size: int = Field(400, description="Grid resolution (NxN)")
    x_min: float = Field(-1, description="X-axis min (m)")
    x_max: float = Field(1, description="X-axis max (m)")
    y_min: float = Field(-1, description="Y-axis min (m)")
    y_max: float = Field(1, description="Y-axis max (m)")
    r_max: float = Field(3, description="Radial profile max distance (m)")
    dpi: int = Field(150, description="Plot DPI (72-600)")


@router.post("/calculate")
def calculate(p: HvacNonmagParams):
    Omega = 2 * np.pi / p.p_c
    mu0 = 4 * np.pi * 1e-7

    sheath_red = sheath_reduction_factor(p.R_s, p.d_s, p.s, p.f)

    I1 = sheath_red * p.I_AC
    I2 = sheath_red * p.I_AC * np.exp(2j * np.pi / 3)
    I3 = sheath_red * p.I_AC * np.exp(4j * np.pi / 3)

    phi01, phi02, phi03 = 0, 2 * np.pi / 3, 4 * np.pi / 3

    dpi = min(max(p.dpi, 72), 600)
    gs = min(p.grid_size, 1200)  # cap for performance
    x_range = np.linspace(p.x_min, p.x_max, gs)
    y_range = np.linspace(p.y_min, p.y_max, gs)
    X, Y = np.meshgrid(x_range, y_range)
    R = np.sqrt(X**2 + Y**2)
    Z = (p.p_c / 2) * np.ones_like(X)

    # Magnetic field
    Br, Bphi, Bz, Bnorm = B_three_helices(
        X, Y, Z, p.R_h, Omega, phi01, phi02, phi03, I1, I2, I3, p.N_calc
    )
    # Electric field via vector potential
    Ar, Aphi, Az, Anorm = A_three_helices(
        X, Y, Z, p.R_h, Omega, phi01, phi02, phi03, I1, I2, I3, p.N_calc
    )
    m = -1j * 2 * np.pi * p.f
    Enorm = np.sqrt(np.abs(m * Ar)**2 + np.abs(m * Aphi)**2 + np.abs(m * Az)**2)

    mask = R < p.r_AC
    Bnorm_uT = np.abs(Bnorm).copy() * 1e6
    Bnorm_uT[mask] = np.nan
    Enorm_Vm = np.abs(Enorm).copy()
    Enorm_Vm[mask] = np.nan

    plots = {}
    cable_shape = [{"type": "circle", "cx": 0.0, "cy": 0.0, "r": float(p.r_AC)}]
    plots["magnetic_surface"] = surface_plot(
        X, Y, Bnorm_uT,
        "Magnetic Field |B| \u2014 HVAC Non-Magnetic",
        "x (m)", "y (m)", "|B| (\u00b5T)", dpi=dpi, shapes=cable_shape
    )
    plots["electric_surface"] = surface_plot(
        X, Y, Enorm_Vm,
        "Electric Field |E| \u2014 HVAC Non-Magnetic",
        "x (m)", "y (m)", "|E| (V/m)", cmap="inferno", dpi=dpi, shapes=cable_shape
    )

    # Radial profile at phi=0
    r_prof = np.linspace(p.r_AC, p.r_max, 500)
    _, _, _, B_rad = B_three_helices(
        r_prof, np.zeros_like(r_prof), np.zeros_like(r_prof),
        p.R_h, Omega, phi01, phi02, phi03, I1, I2, I3, p.N_calc
    )
    plots["radial_profile"] = line_plot(
        r_prof.tolist(), (np.abs(B_rad) * 1e6).tolist(),
        "Radial |B| Profile (\u03c6 = 0\u00b0)",
        "r (m)", "|B| (\u00b5T)", dpi=dpi
    )

    # Azimuthal profile at r=1 m
    theta = np.linspace(0, 2 * np.pi, 500)
    x_az = np.cos(theta)
    y_az = np.sin(theta)
    _, _, _, B_az = B_three_helices(
        x_az, y_az, np.zeros_like(theta),
        p.R_h, Omega, phi01, phi02, phi03, I1, I2, I3, p.N_calc
    )
    plots["azimuthal_profile"] = polar_line_plot(
        theta, (np.abs(B_az) * 1e6).tolist(),
        "Azimuthal |B| at r = 1 m",
        "|B| (\u00b5T)", dpi=dpi
    )

    return {
        "status": "success",
        "plots": plots,
        "results": {
            "max_bfield_uT": float(np.nanmax(Bnorm_uT)),
            "min_bfield_uT": float(np.nanmin(Bnorm_uT)),
            "max_efield_Vm": float(np.nanmax(Enorm_Vm)),
            "min_efield_Vm": float(np.nanmin(Enorm_Vm)),
            "sheath_reduction": float(sheath_red),
        },
    }
