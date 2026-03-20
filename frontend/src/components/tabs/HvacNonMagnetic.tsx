import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ParamForm, type ParamDef } from "@/components/ParamForm";
import { D3Plot as PlotlyPlot } from "@/components/D3Plot";
import { ResultCard } from "@/components/ResultCard";
import { api } from "@/lib/api";
import { Loader2, Zap, Settings } from "lucide-react";

const PARAMS: ParamDef[] = [
  { key: "p_c", label: "Lay length", unit: "m", default: 2.75 },
  { key: "R_h", label: "Helix radius", unit: "m", default: 0.060391 },
  { key: "r_AC", label: "Cable radius", unit: "m", default: 0.1225 },
  { key: "d_s", label: "Sheath diameter", unit: "m", default: 0.0958 },
  { key: "R_s", label: "Sheath resistance", unit: "\u03a9/m", default: 2398.15e-7 },
  { key: "f", label: "Frequency", unit: "Hz", default: 50 },
  { key: "I_AC", label: "Current", unit: "A", default: 1000 },
  { key: "N_calc", label: "Harmonics", unit: "", default: 10 },
  { key: "s", label: "Conductor spacing", unit: "m", default: 0.0892 },
];

const PLOT_PARAMS: ParamDef[] = [
  { key: "grid_size", label: "Grid size", unit: "px", default: 400, step: 50 },
  { key: "dpi", label: "Plot DPI", unit: "", default: 150, step: 50 },
  { key: "x_min", label: "X min", unit: "m", default: -1, step: 0.1 },
  { key: "x_max", label: "X max", unit: "m", default: 1, step: 0.1 },
  { key: "y_min", label: "Y min", unit: "m", default: -1, step: 0.1 },
  { key: "y_max", label: "Y max", unit: "m", default: 1, step: 0.1 },
  { key: "r_max", label: "Radial max", unit: "m", default: 3, step: 0.5 },
];

export function HvacNonMagnetic() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries([...PARAMS, ...PLOT_PARAMS].map((p) => [p.key, p.default])),
  );
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function calculate() {
    setLoading(true);
    setError("");
    try {
      const res = await api.hvacNonmag(values);
      setData(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Section: Cable Parameters */}
      <div className="section-label">
        <span className="font-display text-sm tracking-[0.2em] text-accent">CABLE PARAMETERS</span>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent" />
            <span className="font-display text-lg tracking-[0.15em] text-foreground">INPUT PARAMETERS</span>
          </div>
          <span className="text-[11px] text-muted font-mono">HVAC-NM</span>
        </div>
        <div className="w-full h-px bg-border mb-6" />

        <ParamForm defs={PARAMS} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />

        <div className="w-full h-px bg-border my-6" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 text-accent" />
            <span className="font-display text-sm tracking-[0.15em] text-foreground">PLOT SETTINGS</span>
          </div>
        </div>
        <ParamForm defs={PLOT_PARAMS} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />

        <div className="mt-6">
          <Button onClick={calculate} disabled={loading} size="lg" className="w-72">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            <Zap className="w-4 h-4" />
            CALCULATE
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
      </Card>

      {data?.results && (
        <>
          <div className="section-label">
            <span className="font-display text-sm tracking-[0.2em] text-accent">RESULTS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <ResultCard label="Max B-Field" value={data.results.max_bfield_uT} unit="\u00b5T" />
            <ResultCard label="Min B-Field" value={data.results.min_bfield_uT} unit="\u00b5T" />
            <ResultCard label="Max E-Field" value={data.results.max_efield_Vm} unit="V/m" />
            <ResultCard label="Min E-Field" value={data.results.min_efield_Vm} unit="V/m" />
            <ResultCard label="Sheath Reduction" value={data.results.sheath_reduction.toFixed(4)} />
          </div>
        </>
      )}

      {data?.plots && (
        <>
          <div className="section-label">
            <span className="font-display text-sm tracking-[0.2em] text-accent">FIELD VISUALISATION</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.plots.magnetic_surface && <PlotlyPlot data={data.plots.magnetic_surface} />}
            {data.plots.electric_surface && <PlotlyPlot data={data.plots.electric_surface} />}
            {data.plots.radial_profile && <PlotlyPlot data={data.plots.radial_profile} />}
            {data.plots.azimuthal_profile && <PlotlyPlot data={data.plots.azimuthal_profile} />}
          </div>
        </>
      )}
    </div>
  );
}
