import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ParamForm, type ParamDef } from "@/components/ParamForm";
import { D3Plot as PlotlyPlot } from "@/components/D3Plot";
import { ResultCard } from "@/components/ResultCard";
import { api } from "@/lib/api";
import { Loader2, MapPin, Zap, Settings, Globe } from "lucide-react";

const PARAMS: ParamDef[] = [
  { key: "r_DC", label: "Cable radius", unit: "m", default: 0.06 },
  { key: "cable_angle", label: "Cable angle", unit: "\u00b0", default: 15.119 },
  { key: "cable_slope", label: "Cable slope", unit: "\u00b0", default: 0 },
  { key: "I_DC", label: "Current", unit: "A", default: 1000 },
  { key: "B_earth_X", label: "B_earth X", unit: "nT", default: 9578 },
  { key: "B_earth_Y", label: "B_earth Y", unit: "nT", default: 2588 },
  { key: "B_earth_Z", label: "B_earth Z", unit: "nT", default: 53601 },
];

const PLOT_PARAMS: ParamDef[] = [
  { key: "grid_size", label: "Grid size", unit: "px", default: 400, step: 50 },
  { key: "dpi", label: "Plot DPI", unit: "", default: 150, step: 50 },
  { key: "x_min", label: "X min", unit: "m", default: -1, step: 0.1 },
  { key: "x_max", label: "X max", unit: "m", default: 1, step: 0.1 },
  { key: "y_min", label: "Y min", unit: "m", default: -1, step: 0.1 },
  { key: "y_max", label: "Y max", unit: "m", default: 1, step: 0.1 },
];

export function DCBipole() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries([...PARAMS, ...PLOT_PARAMS].map((p) => [p.key, p.default])),
  );
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [wmmLoading, setWmmLoading] = useState(false);
  const [error, setError] = useState("");
  const [lat, setLat] = useState(50.9);
  const [lon, setLon] = useState(-1.4);

  async function calculate() {
    setLoading(true);
    setError("");
    try {
      setData(await api.dcBipole(values));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchWmm() {
    setWmmLoading(true);
    try {
      const res: any = await api.dcBipoleWmm(lat, lon);
      if (res.status === "success") {
        setValues((p) => ({ ...p, B_earth_X: res.Bx, B_earth_Y: res.By, B_earth_Z: res.Bz }));
      }
    } catch {
    } finally {
      setWmmLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* WMM Lookup */}
      <div className="section-label">
        <span className="font-display text-sm tracking-[0.2em] text-accent">EARTH FIELD LOOKUP</span>
      </div>

      <Card className="border-accent-mid border-2">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Globe className="w-5 h-5 text-accent" />
            <span className="font-display text-lg tracking-[0.15em] text-foreground">WORLD MAGNETIC MODEL</span>
          </div>
          <span className="text-[11px] text-muted font-mono">WMM-LOOKUP</span>
        </div>
        <p className="text-text-secondary text-sm font-light mb-6">
          Retrieve Earth's magnetic field components at a given location using the World Magnetic Model.
        </p>
        <div className="flex gap-4 items-end">
          <Input id="lat" label="LATITUDE" unit="\u00b0" type="number" step="0.1" value={lat} onChange={(e) => setLat(+e.target.value)} />
          <Input id="lon" label="LONGITUDE" unit="\u00b0" type="number" step="0.1" value={lon} onChange={(e) => setLon(+e.target.value)} />
          <Button variant="outline" onClick={fetchWmm} disabled={wmmLoading} className="h-10">
            {wmmLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
            LOOKUP
          </Button>
        </div>
      </Card>

      {/* Cable Parameters */}
      <div className="section-label">
        <span className="font-display text-sm tracking-[0.2em] text-accent">CABLE PARAMETERS</span>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent" />
            <span className="font-display text-lg tracking-[0.15em] text-foreground">INPUT PARAMETERS</span>
          </div>
          <span className="text-[11px] text-muted font-mono">DC-BP</span>
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
            <ResultCard label="Max Bipole" value={data.results.max_bipole_uT} unit="\u00b5T" />
            <ResultCard label="Min Bipole" value={data.results.min_bipole_uT} unit="\u00b5T" />
            <ResultCard label="Max Monopole" value={data.results.max_monopole_uT} unit="\u00b5T" />
            <ResultCard label="Min Monopole" value={data.results.min_monopole_uT} unit="\u00b5T" />
            <ResultCard label="Earth Field" value={data.results.earth_field_nT.toFixed(1)} unit="nT" />
          </div>
        </>
      )}

      {data?.plots && (
        <>
          <div className="section-label">
            <span className="font-display text-sm tracking-[0.2em] text-accent">FIELD VISUALISATION</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.plots.bipole_field && <PlotlyPlot data={data.plots.bipole_field} />}
            {data.plots.perturbation && <PlotlyPlot data={data.plots.perturbation} />}
            {data.plots.monopole_field && <PlotlyPlot data={data.plots.monopole_field} />}
          </div>
        </>
      )}
    </div>
  );
}
