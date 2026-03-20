import { useMemo } from "react";
import createPlotlyComponent from "react-plotly.js/factory";
// @ts-ignore
import Plotly from "plotly.js-dist-min";

const Plot = createPlotlyComponent(Plotly);

/* ── Custom scientific colorscales (dark-theme friendly) ─────────────── */
const VIRIDIS_CUSTOM: [number, string][] = [
  [0.00, "#440154"], [0.10, "#482878"], [0.20, "#3e4989"],
  [0.30, "#31688e"], [0.40, "#26828e"], [0.50, "#1f9e89"],
  [0.60, "#35b779"], [0.70, "#6ece58"], [0.80, "#b5de2b"],
  [0.90, "#d8e219"], [1.00, "#fde725"],
];

const INFERNO_CUSTOM: [number, string][] = [
  [0.00, "#000004"], [0.10, "#1b0c41"], [0.20, "#4a0c6b"],
  [0.30, "#781c6d"], [0.40, "#a52c60"], [0.50, "#cf4446"],
  [0.60, "#ed6925"], [0.70, "#fb9b06"], [0.80, "#f7d13d"],
  [0.90, "#fcffa4"], [1.00, "#fcffa4"],
];

const MAGMA_CUSTOM: [number, string][] = [
  [0.00, "#000004"], [0.10, "#140e36"], [0.20, "#3b0f70"],
  [0.30, "#641a80"], [0.40, "#8c2981"], [0.50, "#b73779"],
  [0.60, "#de4968"], [0.70, "#f7705c"], [0.80, "#fe9f6d"],
  [0.90, "#fecf92"], [1.00, "#fcfdbf"],
];

const RDBU_DIVERGING: [number, string][] = [
  [0.00, "#2166ac"], [0.10, "#4393c3"], [0.20, "#92c5de"],
  [0.30, "#d1e5f0"], [0.40, "#f7f7f7"], [0.50, "#f7f7f7"],
  [0.60, "#fddbc7"], [0.70, "#f4a582"], [0.80, "#d6604d"],
  [0.90, "#b2182b"], [1.00, "#67001f"],
];

const COLORSCALES: Record<string, any> = {
  viridis: VIRIDIS_CUSTOM,
  inferno: INFERNO_CUSTOM,
  magma: MAGMA_CUSTOM,
  cividis: "Cividis",
  "RdBu_r": RDBU_DIVERGING,
  "RdYlBu_r": "RdYlBu",
  plasma: "Plasma",
};

/* ── Types ───────────────────────────────────────────────────────────── */
interface PlotData {
  type: "heatmap" | "line" | "multi_line";
  title: string;
  xlabel: string;
  ylabel: string;
  x?: number[];
  y?: number[];
  z?: (number | null)[][];
  zlabel?: string;
  colorscale?: string;
  contour_levels?: number[];
  color?: string;
  series?: { x: number[]; y: number[]; label: string; color: string }[];
}

/* ── Component ───────────────────────────────────────────────────────── */
export function PlotlyPlot({ data, height = 520 }: { data: PlotData; height?: number }) {
  const { traces, layout } = useMemo(() => {
    const plotTraces: any[] = [];

    const baseAxis = {
      gridcolor: "#1a1a1a",
      gridwidth: 1,
      zerolinecolor: "#333333",
      linecolor: "#333333",
      linewidth: 1,
      tickfont: { size: 11, color: "#bbb", family: "JetBrains Mono, monospace" },
      showgrid: true,
      showline: true,
      mirror: true,
    };

    const plotLayout: any = {
      paper_bgcolor: "#0a0a0a",
      plot_bgcolor: "#0e0e0e",
      font: { family: "Inter, sans-serif", color: "#ccc", size: 12 },
      margin: { l: 70, r: 25, t: 50, b: 60 },
      height,
      autosize: true,
      title: {
        text: `<b>${data.title}</b>`,
        font: { size: 15, color: "#e0e0e0", family: "Inter, sans-serif" },
        x: 0.5,
        xanchor: "center",
        y: 0.98,
      },
      xaxis: {
        ...baseAxis,
        title: { text: data.xlabel, font: { size: 13, color: "#ccc" }, standoff: 10 },
      },
      yaxis: {
        ...baseAxis,
        title: { text: data.ylabel, font: { size: 13, color: "#ccc" }, standoff: 10 },
      },
      hoverlabel: {
        bgcolor: "#111",
        bordercolor: "#CCFF00",
        font: { family: "JetBrains Mono, monospace", size: 12, color: "#fff" },
      },
    };

    if (data.type === "heatmap" && data.z) {
      // Main heatmap trace
      plotTraces.push({
        type: "heatmap",
        x: data.x,
        y: data.y,
        z: data.z,
        colorscale: COLORSCALES[data.colorscale || "viridis"] || VIRIDIS_CUSTOM,
        colorbar: {
          title: {
            text: data.zlabel || "",
            side: "right",
            font: { size: 12, color: "#ccc", family: "Inter, sans-serif" },
          },
          tickfont: { size: 10, color: "#bbb", family: "JetBrains Mono, monospace" },
          outlinecolor: "#333",
          outlinewidth: 1,
          len: 0.85,
          thickness: 20,
          bgcolor: "#0a0a0a",
        },
        hovertemplate:
          `<b>${data.xlabel}:</b> %{x:.4g}<br>` +
          `<b>${data.ylabel}:</b> %{y:.4g}<br>` +
          `<b>${data.zlabel || "Value"}:</b> %{z:.4g}<extra></extra>`,
        zsmooth: "best",
        connectgaps: false,
      });

      // Contour overlay for structure
      if (data.contour_levels && data.contour_levels.length > 2) {
        plotTraces.push({
          type: "contour",
          x: data.x,
          y: data.y,
          z: data.z,
          contours: {
            coloring: "none",
            showlabels: true,
            labelfont: { size: 9, color: "rgba(255,255,255,0.5)", family: "JetBrains Mono" },
            start: data.contour_levels[0],
            end: data.contour_levels[data.contour_levels.length - 1],
            size: (data.contour_levels[data.contour_levels.length - 1] - data.contour_levels[0]) / 10,
          },
          line: { color: "rgba(255,255,255,0.2)", width: 0.8 },
          showscale: false,
          hoverinfo: "skip",
          connectgaps: false,
        });
      }

      plotLayout.yaxis.scaleanchor = "x";
      plotLayout.yaxis.scaleratio = 1;

    } else if (data.type === "line" && data.x && data.y) {
      const c = data.color || "#CCFF00";
      plotTraces.push({
        type: "scatter",
        mode: "lines",
        x: data.x,
        y: data.y,
        line: { color: c, width: 2.5, shape: "spline", smoothing: 0.8 },
        fill: "tozeroy",
        fillcolor: c + "15",
        hovertemplate:
          `<b>${data.xlabel}:</b> %{x:.4g}<br>` +
          `<b>${data.ylabel}:</b> %{y:.4g}<extra></extra>`,
      });

    } else if (data.type === "multi_line" && data.series) {
      for (const s of data.series) {
        plotTraces.push({
          type: "scatter",
          mode: "lines",
          x: s.x,
          y: s.y,
          name: s.label,
          line: { color: s.color, width: 2.5, shape: "spline", smoothing: 0.8 },
          hovertemplate:
            `<b>${s.label}</b><br>` +
            `<b>${data.xlabel}:</b> %{x:.4g}<br>` +
            `<b>${data.ylabel}:</b> %{y:.4g}<extra></extra>`,
        });
      }
      plotLayout.showlegend = true;
      plotLayout.legend = {
        font: { color: "#ccc", size: 11 },
        bgcolor: "rgba(10,10,10,0.9)",
        bordercolor: "#333",
        borderwidth: 1,
      };
    }

    return { traces: plotTraces, layout: plotLayout };
  }, [data, height]);

  return (
    <div className="border border-border bg-background overflow-hidden">
      <Plot
        data={traces}
        layout={layout}
        config={{
          responsive: true,
          displayModeBar: true,
          modeBarButtonsToRemove: ["lasso2d", "select2d"] as any[],
          displaylogo: false,
          toImageButtonOptions: {
            format: "png",
            filename: data.title.replace(/[^a-zA-Z0-9]/g, "_"),
            height: 1200,
            width: 1600,
            scale: 2,
          },
        }}
        useResizeHandler
        style={{ width: "100%", height: `${height}px` }}
      />
    </div>
  );
}
