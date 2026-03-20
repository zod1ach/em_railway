import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ParamForm, type ParamDef } from "@/components/ParamForm";
import { D3Plot as PlotlyPlot } from "@/components/D3Plot";
import { ResultCard } from "@/components/ResultCard";
import { api } from "@/lib/api";
import { Loader2, Zap, Settings, Route } from "lucide-react";

const PARAMS: ParamDef[] = [
  { key: "r_DC", label: "Cable radius", unit: "m", default: 0.06 },
  { key: "cable_angle", label: "Cable angle", unit: "\u00b0", default: 15.119 },
  { key: "cable_slope", label: "Cable slope", unit: "\u00b0", default: 0 },
  { key: "I_DC", label: "Current", unit: "A", default: 1000 },
  { key: "step_size", label: "Step size", unit: "m", default: 100 },
  { key: "cross_radius", label: "Cross-section R", unit: "m", default: 2.0 },
  { key: "n_radial", label: "Radial points", unit: "", default: 50 },
  { key: "n_angular", label: "Angular points", unit: "", default: 36 },
];

const PLOT_PARAMS: ParamDef[] = [
  { key: "dpi", label: "Plot DPI", unit: "", default: 150, step: 50 },
];

export function Cable3D() {
  const [values, setValues] = useState<Record<string, number>>(
    Object.fromEntries([...PARAMS, ...PLOT_PARAMS].map((p) => [p.key, p.default])),
  );
  const [routeText, setRouteText] = useState("-5,50\n-3,52\n-1,54\n1,56\n3,58");
  const [date, setDate] = useState("");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function calculate() {
    setLoading(true);
    setError("");
    try {
      const route_coords = routeText.split("\n").filter(Boolean).map((l) => l.split(",").map(Number));
      setData(await api.cable3d({ ...values, route_coords, date }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="section-label">
        <span className="font-display text-sm tracking-[0.2em] text-accent">CABLE PARAMETERS</span>
      </div>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Route className="w-5 h-5 text-accent" />
            <span className="font-display text-lg tracking-[0.15em] text-foreground">CABLE & ROUTE PARAMETERS</span>
          </div>
          <span className="text-[11px] text-muted font-mono">CABLE-3D</span>
        </div>
        <div className="w-full h-px bg-border mb-6" />

        <ParamForm defs={PARAMS} values={values} onChange={(k, v) => setValues((p) => ({ ...p, [k]: v }))} />

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] text-muted font-display tracking-[0.15em]">ROUTE (LON,LAT PER LINE)</label>
            <textarea
              rows={5}
              value={routeText}
              onChange={(e) => setRouteText(e.target.value)}
              className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
            />
          </div>
          <div>
            <Input id="date3d" label="DATE (DD/MM/YYYY)" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

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
            CALCULATE ROUTE
          </Button>
        </div>
        {error && <p className="mt-3 text-sm text-error">{error}</p>}
      </Card>

      {data?.total_distance_km && (
        <>
          <div className="section-label">
            <span className="font-display text-sm tracking-[0.2em] text-accent">RESULTS</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <ResultCard label="Total distance" value={data.total_distance_km.toFixed(1)} unit="km" />
            <ResultCard label="Sample points" value={data.points?.length ?? 0} />
          </div>
        </>
      )}

      {data?.plots && (
        <>
          <div className="section-label">
            <span className="font-display text-sm tracking-[0.2em] text-accent">FIELD VISUALISATION</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(data.plots).map(([key, val]) => (
              <PlotlyPlot key={key} data={val as any} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
