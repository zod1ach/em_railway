/**
 * Shared parameter definitions used across forms and batch wizard.
 * Single source of truth for param key, label, unit, and default value.
 */

export interface ParamDef {
  key: string;
  label: string;
  unit: string;
  default: number | string;
}

/* ── HVAC Parameters ── */

export const HVAC_CORE_PARAMS: readonly ParamDef[] = [
  { key: "p_c", label: "Lay Length", unit: "m", default: 2.75 },
  { key: "R_h", label: "Helix Radius", unit: "m", default: 0.060391 },
  { key: "r_AC", label: "Cable Radius", unit: "m", default: 0.1225 },
  { key: "d_s", label: "Sheath Diameter", unit: "m", default: 0.0958 },
  { key: "R_s", label: "Sheath Resistance", unit: "Ω/m", default: 2398.15e-7 },
  { key: "f", label: "Frequency", unit: "Hz", default: 50 },
  { key: "I_AC", label: "Current", unit: "A", default: 1000 },
  { key: "N_calc", label: "Harmonics", unit: "", default: 10 },
  { key: "s", label: "Conductor Spacing", unit: "m", default: 0.0892 },
] as const;

export const HVAC_MAGNETIC_PARAMS: readonly ParamDef[] = [
  { key: "N", label: "Armour Wires", unit: "", default: 110 },
  { key: "d_f", label: "Wire Diameter", unit: "m", default: 0.0056 },
  { key: "d_A", label: "Armour Diameter", unit: "m", default: 0.2056 },
  { key: "p_A", label: "Armour Pitch", unit: "m", default: 3.084 },
  { key: "lay_factor", label: "Lay Factor", unit: "", default: -1 },
  { key: "mu_r_real", label: "μr (Real)", unit: "", default: 100 },
  { key: "mu_r_imag", label: "μr (Imag)", unit: "", default: -50 },
  { key: "sigma", label: "Conductivity", unit: "S/m", default: 4.03e6 },
  { key: "t", label: "Wire Thickness", unit: "m", default: 0.005 },
] as const;

/* ── DC Bipole Parameters ── */

export const DC_CABLE_PARAMS: readonly ParamDef[] = [
  { key: "r_DC", label: "Cable Radius", unit: "m", default: 0.06 },
  { key: "cable_angle", label: "Cable Angle", unit: "°", default: 15.119 },
  { key: "cable_slope", label: "Cable Slope", unit: "°", default: 0 },
  { key: "I_DC", label: "Current", unit: "A", default: 1000 },
] as const;

export const DC_EARTH_PARAMS: readonly ParamDef[] = [
  { key: "B_earth_X", label: "B_EARTH X", unit: "nT", default: 9578 },
  { key: "B_earth_Y", label: "B_EARTH Y", unit: "nT", default: 2588 },
  { key: "B_earth_Z", label: "B_EARTH Z", unit: "nT", default: 53601 },
  { key: "wmm_date", label: "Date", unit: "DD/MM/YYYY", default: "" },
] as const;

/* ── Helpers ── */

/** All HVAC params (core + magnetic armour) */
export const ALL_HVAC_PARAMS: readonly ParamDef[] = [
  ...HVAC_CORE_PARAMS,
  ...HVAC_MAGNETIC_PARAMS,
];

/** All DC Bipole params (cable + earth) */
export const ALL_DC_PARAMS: readonly ParamDef[] = [
  ...DC_CABLE_PARAMS,
  ...DC_EARTH_PARAMS,
];

/** Average file sizes in bytes for batch size estimation */
export const AVG_FILE_SIZES: Record<string, number> = {
  hvac_non_magnetic: 10_000,
  hvac_magnetic: 14_000,
  dc_cable: 11_000,
  dc_location: 12_000,
};

/** Batch cap thresholds */
export const BATCH_CAP = {
  GREEN: 100,
  AMBER: 250,
  MAX: 500,
} as const;
