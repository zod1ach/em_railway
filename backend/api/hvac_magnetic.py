"""HVAC Magnetic Armour calculation endpoint."""
from fastapi import APIRouter
from pydantic import BaseModel, Field
import numpy as np
from calculations.fields import B_three_helices_armour, E_three_helices_armour
from calculations.armour import sheath_reduction_factor
from .plot_helpers import surface_plot

router = APIRouter()


class HvacMagParams(BaseModel):
    p_c: float = Field(2.750)
    R_h: float = Field(0.060391)
    r_AC: float = Field(0.1225)
    d_s: float = Field(0.0958)
    R_s: float = Field(2398.15e-7)
    f: float = Field(50)
    I_AC: float = Field(1000)
    N_calc: int = Field(10)
    s: float = Field(0.0892)
    # Armour parameters
    N: int = Field(110, description="Number of armour wires")
    d_f: float = Field(0.0056, description="Wire diameter (m)")
    d_A: float = Field(0.2056, description="Armour diameter (m)")
    p_A: float = Field(3.084, description="Armour pitch (m)")
    lay_factor: float = Field(-1)
    mu_r_real: float = Field(100)
    mu_r_imag: float = Field(-50)
    sigma: float = Field(4.03e6, description="Conductivity (S/m)")
    t: float = Field(0.005, description="Wire thickness (m)")
    grid_size: int = Field(400)
    x_min: float = Field(-1, description="X-axis min (m)")
    x_max: float = Field(1, description="X-axis max (m)")
    y_min: float = Field(-1, description="Y-axis min (m)")
    y_max: float = Field(1, description="Y-axis max (m)")
    dpi: int = Field(150, description="Plot DPI (72-600)")


@router.post("/calculate")
def calculate(p: HvacMagParams):
    Omega = 2 * np.pi / p.p_c
    mu_r = p.mu_r_real + 1j * p.mu_r_imag

    sheath_red = sheath_reduction_factor(p.R_s, p.d_s, p.s, p.f)
    I1 = sheath_red * p.I_AC
    I2 = sheath_red * p.I_AC * np.exp(2j * np.pi / 3)
    I3 = sheath_red * p.I_AC * np.exp(4j * np.pi / 3)
    phi01, phi02, phi03 = 0, 2 * np.pi / 3, 4 * np.pi / 3

    dpi = min(max(p.dpi, 72), 600)
    gs = min(p.grid_size, 1200)
    x_range = np.linspace(p.x_min, p.x_max, gs)
    y_range = np.linspace(p.y_min, p.y_max, gs)
    X, Y = np.meshgrid(x_range, y_range)
    R = np.sqrt(X**2 + Y**2)
    Z = (p.p_c / 2) * np.ones_like(X)

    _, _, _, Bnorm = B_three_helices_armour(
        X, Y, Z, p.R_h, Omega, phi01, phi02, phi03,
        I1, I2, I3, p.N_calc,
        p.N, p.d_f, p.d_A, p.p_A, p.p_c, p.t, p.lay_factor, p.f, mu_r, p.sigma
    )

    _, _, _, Enorm = E_three_helices_armour(
        X, Y, Z, p.R_h, Omega, phi01, phi02, phi03,
        I1, I2, I3, p.N_calc,
        p.N, p.d_f, p.d_A, p.p_A, p.p_c, p.t, p.lay_factor, p.f, mu_r, p.sigma, p.r_AC
    )

    mask = R < p.r_AC
    Bnorm_uT = np.abs(Bnorm).copy() * 1e6
    Bnorm_uT[mask] = np.nan
    Enorm_Vm = np.abs(Enorm).copy()
    Enorm_Vm[mask] = np.nan

    cable_shape = [{"type": "circle", "cx": 0.0, "cy": 0.0, "r": float(p.r_AC)}]
    plots = {
        "magnetic_surface": surface_plot(
            X, Y, Bnorm_uT,
            "|B| with Magnetic Armour", "x (m)", "y (m)",
            "|B| (\u00b5T)", dpi=dpi, shapes=cable_shape
        ),
        "electric_surface": surface_plot(
            X, Y, Enorm_Vm,
            "|E| with Magnetic Armour", "x (m)", "y (m)",
            "|E| (V/m)", cmap="inferno", dpi=dpi, shapes=cable_shape
        ),
    }

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
