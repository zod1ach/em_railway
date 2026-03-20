import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

/* ── Types ──────────────────────────────────────────────────────────────── */
interface CircleShape {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
}

export interface PlotData {
  type: "heatmap" | "line" | "multi_line";
  title: string;
  xlabel: string;
  ylabel: string;
  // heatmap
  x?: number[];
  y?: number[];
  z?: (number | null)[][];
  zlabel?: string;
  colorscale?: string;
  contour_levels?: number[];
  zmin?: number;
  zmax?: number;
  shapes?: CircleShape[];
  // line
  color?: string;
  // multi_line
  series?: { x: number[]; y: number[]; label: string; color: string }[];
}

/* ── Layout constants ───────────────────────────────────────────────────── */
const M = { top: 50, right: 120, bottom: 65, left: 80 };

/* ── Dark theme palette ─────────────────────────────────────────────────── */
const BG        = "#0a0a0a";
const PLOT_BG   = "#0e0e0e";
const GRID_COL  = "#1f1f1f";
const AXIS_COL  = "#444";
const TICK_COL  = "#aaa";
const LABEL_COL = "#ccc";
const TITLE_COL = "#e8e8e8";
const ACCENT    = "#CCFF00";

/* ── D3 colorscale interpolators ────────────────────────────────────────── */
const INTERP: Record<string, (t: number) => string> = {
  viridis:    d3.interpolateViridis,
  inferno:    d3.interpolateInferno,
  magma:      d3.interpolateMagma,
  plasma:     d3.interpolatePlasma,
  cividis:    d3.interpolateCividis,
  "RdBu_r":   (t) => d3.interpolateRdBu(1 - t),
  "RdYlBu_r": (t) => d3.interpolateRdYlBu(1 - t),
};

function parseRgb(colorStr: string): [number, number, number] {
  const c = d3.color(colorStr)?.rgb();
  if (!c) return [0, 0, 0];
  return [Math.round(c.r), Math.round(c.g), Math.round(c.b)];
}

const fmtTick = (v: d3.NumberValue) => {
  const n = Number(v);
  if (n === 0) return "0";
  if (Math.abs(n) >= 1e4 || (Math.abs(n) < 1e-2 && n !== 0))
    return d3.format(".2e")(n);
  return d3.format(".4~g")(n);
};

/* ── Component ──────────────────────────────────────────────────────────── */
export function D3Plot({
  data,
  height = 520,
}: {
  data: PlotData;
  height?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  /* Track container width via ResizeObserver */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) setContainerWidth(e.contentRect.width);
    });
    obs.observe(el);
    setContainerWidth(el.clientWidth);
    return () => obs.disconnect();
  }, []);

  /* Main render */
  useEffect(() => {
    const canvas = canvasRef.current;
    const svgEl  = svgRef.current;
    if (!canvas || !svgEl || containerWidth < 120) return;

    const width = containerWidth;
    const plotW = width  - M.left - M.right;
    const plotH = height - M.top  - M.bottom;
    if (plotW < 50 || plotH < 50) return;

    /* ── Canvas setup ──────────────────────────────────────────────── */
    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = PLOT_BG;
    ctx.fillRect(M.left, M.top, plotW, plotH);

    /* ── SVG setup ─────────────────────────────────────────────────── */
    const svg = d3.select(svgEl)
      .attr("width",  width)
      .attr("height", height);
    svg.selectAll("*").remove();

    /* ── Dispatch by type ──────────────────────────────────────────── */
    if (data.type === "heatmap" && data.x && data.y && data.z) {
      renderHeatmap(ctx, svg, width, plotW, plotH, data);
    } else if (data.type === "line" || data.type === "multi_line") {
      renderLine(ctx, svg, plotW, plotH, data);
    }
  }, [data, height, containerWidth]);

  return (
    <div
      ref={containerRef}
      className="border border-border bg-background overflow-hidden"
      style={{ position: "relative", height: `${height}px` }}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0 }} />
      <svg
        ref={svgRef}
        style={{ position: "absolute", top: 0, left: 0, overflow: "visible" }}
      />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HEATMAP RENDERER
   ════════════════════════════════════════════════════════════════════════ */
function renderHeatmap(
  ctx:    CanvasRenderingContext2D,
  svg:    d3.Selection<SVGSVGElement, unknown, null, undefined>,
  width:  number,
  plotW:  number,
  plotH:  number,
  data:   PlotData,
) {
  const xs    = data.x!;
  const ys    = data.y!;
  const zs    = data.z!;
  const ncols = xs.length;
  const nrows = ys.length;

  const zmin = data.zmin ?? 0;
  const zmax = data.zmax ?? 1;
  const interp = INTERP[data.colorscale ?? "viridis"] ?? d3.interpolateViridis;

  /* ── D3 scales ─────────────────────────────────────────────────────── */
  const xScale = d3.scaleLinear([xs[0], xs[ncols - 1]], [0, plotW]);
  const yScale = d3.scaleLinear([ys[0], ys[nrows - 1]], [plotH, 0]);

  /* ── Paint heatmap via offscreen canvas ────────────────────────────── */
  const off    = document.createElement("canvas");
  off.width    = ncols;
  off.height   = nrows;
  const offCtx = off.getContext("2d")!;
  const img    = offCtx.createImageData(ncols, nrows);

  for (let row = 0; row < nrows; row++) {
    // Flip: canvas row 0 = top = highest y; data row 0 = lowest y
    const dataRow = nrows - 1 - row;
    for (let col = 0; col < ncols; col++) {
      const val = zs[dataRow][col];
      const idx = (row * ncols + col) * 4;
      if (val === null || val === undefined) {
        img.data[idx + 3] = 0; // transparent → shows PLOT_BG through canvas
      } else {
        const t = Math.max(0, Math.min(1, (val - zmin) / (zmax - zmin)));
        const [r, g, b] = parseRgb(interp(t));
        img.data[idx]     = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
  }

  offCtx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled  = true;
  ctx.imageSmoothingQuality  = "high";
  ctx.drawImage(off, 0, 0, ncols, nrows, M.left, M.top, plotW, plotH);

  /* ── Grid lines (SVG) ──────────────────────────────────────────────── */
  const gGrid = svg.append("g").attr("class", "grid");
  xScale.ticks(7).forEach((t) => {
    gGrid.append("line")
      .attr("x1", M.left + xScale(t)).attr("x2", M.left + xScale(t))
      .attr("y1", M.top).attr("y2", M.top + plotH)
      .attr("stroke", GRID_COL).attr("stroke-width", 1);
  });
  yScale.ticks(7).forEach((t) => {
    gGrid.append("line")
      .attr("x1", M.left).attr("x2", M.left + plotW)
      .attr("y1", M.top + yScale(t)).attr("y2", M.top + yScale(t))
      .attr("stroke", GRID_COL).attr("stroke-width", 1);
  });

  /* ── Contour lines ─────────────────────────────────────────────────── */
  const levels = data.contour_levels;
  if (levels && levels.length > 2) {
    // Flatten z in data order (row 0 = ys[0] = bottom of plot)
    const flatZ: number[] = new Array(nrows * ncols);
    for (let row = 0; row < nrows; row++) {
      for (let col = 0; col < ncols; col++) {
        flatZ[row * ncols + col] = zs[row][col] ?? 0;
      }
    }

    const nLevels   = Math.min(12, levels.length);
    const thresholds = d3.range(nLevels).map(
      (i) => levels[0] + (i / (nLevels - 1)) * (levels[levels.length - 1] - levels[0])
    );

    const contoursGen = d3.contours().size([ncols, nrows]).thresholds(thresholds);
    const paths = contoursGen(flatZ);

    // d3.contours col/row space → screen pixels
    // col ∈ [0, ncols], row ∈ [0, nrows]; row=0 corresponds to data row 0 = ys[0] = bottom
    const projection = d3.geoTransform({
      point(col: number, row: number) {
        const xv = xs[0] + (col / ncols) * (xs[ncols - 1] - xs[0]);
        const yv = ys[0] + (row / nrows) * (ys[nrows - 1] - ys[0]);
        this.stream.point(M.left + xScale(xv), M.top + yScale(yv));
      },
    });
    const pathGen = d3.geoPath().projection(projection);

    const gContour = svg.append("g").attr("class", "contours");
    paths.forEach((path) => {
      gContour.append("path")
        .datum(path)
        .attr("d", pathGen)
        .attr("fill", "none")
        .attr("stroke", "rgba(255,255,255,0.40)")
        .attr("stroke-width", 0.9)
        .attr("stroke-linejoin", "round");
    });
  }

  /* ── Cable / conductor boundary shapes ─────────────────────────────── */
  if (data.shapes && data.shapes.length > 0) {
    const gShapes = svg.append("g").attr("class", "shapes");
    data.shapes.forEach((s) => {
      if (s.type !== "circle") return;
      const px  = M.left + xScale(s.cx);
      const py  = M.top  + yScale(s.cy);
      const rxPx = Math.abs(xScale(s.cx + s.r) - xScale(s.cx));
      const ryPx = Math.abs(yScale(s.cy) - yScale(s.cy + s.r));

      // Filled disc to cover the NaN black region
      gShapes.append("ellipse")
        .attr("cx", px).attr("cy", py)
        .attr("rx", rxPx).attr("ry", ryPx)
        .attr("fill", PLOT_BG);

      // Crisp white boundary ring
      gShapes.append("ellipse")
        .attr("cx", px).attr("cy", py)
        .attr("rx", rxPx).attr("ry", ryPx)
        .attr("fill", "none")
        .attr("stroke", "rgba(230,230,230,0.85)")
        .attr("stroke-width", 1.8);

      // Centre dot + label
      gShapes.append("circle")
        .attr("cx", px).attr("cy", py).attr("r", 2)
        .attr("fill", "rgba(200,200,200,0.6)");
      gShapes.append("text")
        .attr("x", px).attr("y", py - ryPx - 5)
        .attr("text-anchor", "middle")
        .attr("fill", "rgba(190,190,190,0.7)")
        .attr("font-size", "9px")
        .attr("font-family", "JetBrains Mono, monospace")
        .text("cable");
    });
  }

  /* ── Axes, labels, title ────────────────────────────────────────────── */
  drawAxes(svg, xScale, yScale, plotW, plotH, data);

  /* ── Colorbar ───────────────────────────────────────────────────────── */
  drawColorbar(svg, width, plotH, zmin, zmax, interp, data.zlabel ?? "");
}

/* ════════════════════════════════════════════════════════════════════════
   LINE RENDERER
   ════════════════════════════════════════════════════════════════════════ */
function renderLine(
  ctx:   CanvasRenderingContext2D,
  svg:   d3.Selection<SVGSVGElement, unknown, null, undefined>,
  plotW: number,
  plotH: number,
  data:  PlotData,
) {
  let seriesList: { x: number[]; y: number[]; label: string; color: string }[] = [];

  if (data.type === "multi_line" && data.series) {
    seriesList = data.series;
  } else if (data.x && data.y) {
    seriesList = [{ x: data.x, y: data.y, label: "", color: data.color ?? ACCENT }];
  }

  if (!seriesList.length) return;

  const allX = seriesList.flatMap((s) => s.x);
  const allY = seriesList.flatMap((s) => s.y);

  const [xMin, xMax] = d3.extent(allX) as [number, number];
  const [yMin, yMax] = d3.extent(allY) as [number, number];
  const yPad = (yMax - yMin) * 0.06;

  const xScale = d3.scaleLinear([xMin, xMax], [0, plotW]);
  const yScale = d3.scaleLinear([yMin - yPad, yMax + yPad], [plotH, 0]);

  /* ── Grid on canvas ───────────────────────────────────────────────── */
  ctx.strokeStyle = GRID_COL;
  ctx.lineWidth   = 1;
  xScale.ticks(6).forEach((t) => {
    const px = M.left + xScale(t);
    ctx.beginPath(); ctx.moveTo(px, M.top); ctx.lineTo(px, M.top + plotH); ctx.stroke();
  });
  yScale.ticks(6).forEach((t) => {
    const py = M.top + yScale(t);
    ctx.beginPath(); ctx.moveTo(M.left, py); ctx.lineTo(M.left + plotW, py); ctx.stroke();
  });

  /* ── Lines + area fills (SVG) ─────────────────────────────────────── */
  const curveFn = d3.curveCatmullRom.alpha(0.5);
  const lineFn  = d3.line<[number, number]>()
    .x(([x]) => M.left + xScale(x))
    .y(([, y]) => M.top + yScale(y))
    .curve(curveFn);

  const gLines = svg.append("g");

  seriesList.forEach((s) => {
    const pts = s.x.map((xi, i) => [xi, s.y[i]] as [number, number]);

    // Area fill (only single series)
    if (seriesList.length === 1) {
      const areaFn = d3.area<[number, number]>()
        .x(([x])    => M.left + xScale(x))
        .y0(M.top + yScale(yMin - yPad))
        .y1(([, y]) => M.top + yScale(y))
        .curve(curveFn);
      gLines.append("path")
        .datum(pts)
        .attr("d", areaFn)
        .attr("fill", s.color + "20")
        .attr("stroke", "none");
    }

    // Line
    gLines.append("path")
      .datum(pts)
      .attr("d", lineFn)
      .attr("fill", "none")
      .attr("stroke", s.color)
      .attr("stroke-width", 2.5)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");
  });

  /* ── Legend (multi-line) ────────────────────────────────────────────── */
  if (data.type === "multi_line" && seriesList.length > 1) {
    const leg = svg.append("g")
      .attr("transform", `translate(${M.left + plotW - 10},${M.top + 12})`);
    seriesList.forEach((s, i) => {
      const ly = i * 22;
      leg.append("line")
        .attr("x1", -50).attr("x2", -14)
        .attr("y1", ly + 7).attr("y2", ly + 7)
        .attr("stroke", s.color).attr("stroke-width", 2.5);
      leg.append("text")
        .attr("x", -54).attr("y", ly + 11)
        .attr("text-anchor", "end")
        .attr("fill", LABEL_COL)
        .attr("font-size", "11px")
        .attr("font-family", "Inter, sans-serif")
        .text(s.label);
    });
  }

  drawAxes(svg, xScale, yScale, plotW, plotH, data);
}

/* ════════════════════════════════════════════════════════════════════════
   SHARED: AXES + LABELS + TITLE
   ════════════════════════════════════════════════════════════════════════ */
function drawAxes(
  svg:    d3.Selection<SVGSVGElement, unknown, null, undefined>,
  xScale: d3.ScaleLinear<number, number>,
  yScale: d3.ScaleLinear<number, number>,
  plotW:  number,
  plotH:  number,
  data:   PlotData,
) {
  /* Bottom x-axis */
  svg.append("g")
    .attr("transform", `translate(${M.left},${M.top + plotH})`)
    .call(
      d3.axisBottom(xScale).ticks(7).tickSize(5)
        .tickFormat(fmtTick as any)
    )
    .call((g) => {
      g.select(".domain").attr("stroke", AXIS_COL);
      g.selectAll(".tick line").attr("stroke", AXIS_COL);
      g.selectAll(".tick text")
        .attr("fill", TICK_COL)
        .attr("font-size", "11px")
        .attr("font-family", "JetBrains Mono, monospace");
    });

  /* Left y-axis */
  svg.append("g")
    .attr("transform", `translate(${M.left},${M.top})`)
    .call(
      d3.axisLeft(yScale).ticks(7).tickSize(5)
        .tickFormat(fmtTick as any)
    )
    .call((g) => {
      g.select(".domain").attr("stroke", AXIS_COL);
      g.selectAll(".tick line").attr("stroke", AXIS_COL);
      g.selectAll(".tick text")
        .attr("fill", TICK_COL)
        .attr("font-size", "11px")
        .attr("font-family", "JetBrains Mono, monospace");
    });

  /* Top border (no ticks) */
  svg.append("line")
    .attr("x1", M.left).attr("x2", M.left + plotW)
    .attr("y1", M.top).attr("y2", M.top)
    .attr("stroke", AXIS_COL).attr("stroke-width", 1);

  /* Right border (no ticks) */
  svg.append("line")
    .attr("x1", M.left + plotW).attr("x2", M.left + plotW)
    .attr("y1", M.top).attr("y2", M.top + plotH)
    .attr("stroke", AXIS_COL).attr("stroke-width", 1);

  /* X axis label */
  svg.append("text")
    .attr("x", M.left + plotW / 2)
    .attr("y", M.top + plotH + 48)
    .attr("text-anchor", "middle")
    .attr("fill", LABEL_COL)
    .attr("font-size", "13px")
    .attr("font-family", "Inter, sans-serif")
    .text(data.xlabel);

  /* Y axis label */
  svg.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -(M.top + plotH / 2))
    .attr("y", 18)
    .attr("text-anchor", "middle")
    .attr("fill", LABEL_COL)
    .attr("font-size", "13px")
    .attr("font-family", "Inter, sans-serif")
    .text(data.ylabel);

  /* Title */
  svg.append("text")
    .attr("x", M.left + plotW / 2)
    .attr("y", 28)
    .attr("text-anchor", "middle")
    .attr("fill", TITLE_COL)
    .attr("font-size", "14px")
    .attr("font-weight", "600")
    .attr("font-family", "Inter, sans-serif")
    .text(data.title);
}

/* ════════════════════════════════════════════════════════════════════════
   COLORBAR
   ════════════════════════════════════════════════════════════════════════ */
function drawColorbar(
  svg:      d3.Selection<SVGSVGElement, unknown, null, undefined>,
  svgWidth: number,
  plotH:    number,
  zmin:     number,
  zmax:     number,
  interp:   (t: number) => string,
  label:    string,
) {
  const cbLeft = svgWidth - M.right + 18;
  const cbW    = 16;
  const cbH    = plotH;

  /* Gradient definition */
  const gradId = `cb-${Math.random().toString(36).slice(2)}`;
  const defs   = svg.append("defs");
  const grad   = defs.append("linearGradient")
    .attr("id", gradId)
    .attr("x1", "0").attr("y1", "1")
    .attr("x2", "0").attr("y2", "0");

  for (let i = 0; i <= 64; i++) {
    const t = i / 64;
    grad.append("stop")
      .attr("offset", `${(t * 100).toFixed(1)}%`)
      .attr("stop-color", interp(t));
  }

  /* Colorbar rect */
  svg.append("rect")
    .attr("x", cbLeft).attr("y", M.top)
    .attr("width", cbW).attr("height", cbH)
    .attr("fill", `url(#${gradId})`)
    .attr("stroke", "#555").attr("stroke-width", 0.5);

  /* Tick axis */
  const cbScale = d3.scaleLinear([zmin, zmax], [cbH, 0]);
  svg.append("g")
    .attr("transform", `translate(${cbLeft + cbW},${M.top})`)
    .call(
      d3.axisRight(cbScale).ticks(6).tickSize(4)
        .tickFormat(fmtTick as any)
    )
    .call((g) => {
      g.select(".domain").attr("stroke", "#555");
      g.selectAll(".tick line").attr("stroke", "#555");
      g.selectAll(".tick text")
        .attr("fill", TICK_COL)
        .attr("font-size", "10px")
        .attr("font-family", "JetBrains Mono, monospace");
    });

  /* Label — rotated 90°, positioned to the right of tick marks */
  const labelX = cbLeft + cbW + 52; // right of ticks (~40px) + gap
  const labelY = M.top + cbH / 2;
  svg.append("text")
    .attr("transform", `translate(${labelX},${labelY}) rotate(-90)`)
    .attr("text-anchor", "middle")
    .attr("fill", LABEL_COL)
    .attr("font-size", "12px")
    .attr("font-family", "Inter, sans-serif")
    .text(label);
}
