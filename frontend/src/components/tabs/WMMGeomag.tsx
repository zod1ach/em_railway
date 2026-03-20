import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { D3Plot as PlotlyPlot } from "@/components/D3Plot";
import { ResultCard } from "@/components/ResultCard";
import { api } from "@/lib/api";
import { Loader2, Zap, Grid3x3, TrendingUp, Settings } from "lucide-react";

export function WMMGeomag() {
  const [mode, setMode] = useState<"grid" | "line">("grid");

  const [lon0, setLon0] = useState(-10);
  const [lon1, setLon1] = useState(5);
  const [lat0, setLat0] = useState(48);
  const [lat1, setLat1] = useState(62);
  const [res, setRes] = useState(0.5);
  const [date, setDate] = useState("");

  const [lineText, setLineText] = useState("-5,50\n0,55\n3,58");
  const [nPoints, setNPoints] = useState(200);

  const [dpi, setDpi] = useState(150);

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function calculate() {
    setLoading(true);
    setError("");
    try {
      if (mode === "grid") {
        setData(await api.wmmGrid({ lon0, lon1, lat0, lat1, resolution: res, date, dpi }));
      } else {
        const coords = lineText.split("\n").filter(Boolean).map((l) => l.split(",").map(Number));
        setData(await api.wmmLine({ coords, n_points: nPoints, date, dpi }));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="section-label">
        <span className="font-display text-sm tracking-[0.2em] text-accent">WMM GEOMAGNETIC MODEL</span>
      </div>

      {/* Mode Toggle */}
      <div className="flex border border-border bg-surface">
        {(["grid", "line"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex items-center justify-center gap-2 h-11 px-7 font-display text-sm tracking-[0.12em] transition-colors ${
              mode === m
                ? "bg-accent text-background"
                : "text-muted hover:text-text-secondary"
            }`}
          >
            {m === "grid" ? <Grid3x3 className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
            {m === "grid" ? "GRID MODE" : "LINE MODE"}
          </button>
        ))}
      </div>

      {/* Grid Mode */}
      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent" />
            <span className="font-display text-lg tracking-[0.15em] text-foreground">
              {mode === "grid" ? "GRID PARAMETERS" : "LINE PARAMETERS"}
            </span>
          </div>
          <span className="text-[11px] text-muted font-mono">WMM</span>
        </div>
        <div className="w-full h-px bg-border mb-6" />

        {mode === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <Input id="lon0" label="LON MIN" unit="\u00b0" type="number" value={lon0} onChange={(e) => setLon0(+e.target.value)} />
            <Input id="lon1" label="LON MAX" unit="\u00b0" type="number" value={lon1} onChange={(e) => setLon1(+e.target.value)} />
            <Input id="lat0" label="LAT MIN" unit="\u00b0" type="number" value={lat0} onChange={(e) => setLat0(+e.target.value)} />
            <Input id="lat1" label="LAT MAX" unit="\u00b0" type="number" value={lat1} onChange={(e) => setLat1(+e.target.value)} />
            <Input id="res" label="RESOLUTION" unit="\u00b0" type="number" step="0.1" value={res} onChange={(e) => setRes(+e.target.value)} />
            <Input id="date" label="DATE (DD/MM/YYYY)" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-[11px] text-muted font-display tracking-[0.15em]">COORDINATES (LON,LAT PER LINE)</label>
              <textarea
                rows={5}
                value={lineText}
                onChange={(e) => setLineText(e.target.value)}
                className="mt-1.5 w-full border border-border bg-background px-3 py-2 text-sm font-mono text-foreground focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input id="npts" label="INTERPOLATION POINTS" type="number" value={nPoints} onChange={(e) => setNPoints(+e.target.value)} />
              <Input id="date2" label="DATE (DD/MM/YYYY)" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        )}

        <div className="w-full h-px bg-border my-6" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-4 h-4 text-accent" />
            <span className="font-display text-sm tracking-[0.15em] text-foreground">PLOT SETTINGS</span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <Input id="dpi" label="PLOT DPI" type="number" step="50" value={dpi} onChange={(e) => setDpi(+e.target.value)} />
        </div>

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ResultCard label="F max" value={data.results.f_max?.toFixed(1) ?? "-"} unit="nT" />
            <ResultCard label="F min" value={data.results.f_min?.toFixed(1) ?? "-"} unit="nT" />
            <ResultCard label="F mean" value={data.results.f_mean?.toFixed(1) ?? "-"} unit="nT" />
            <ResultCard label="Total points" value={data.results.total_points ?? "-"} />
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
