/**
 * Workflow canvas type system — ports, nodes, connections, graph.
 */

/* ── Port data types ── */
export type PortType =
  | "CableParams"
  | "WMMParams"
  | "Grid2D"
  | "Series1D"
  | "PolarData"
  | "GeoData"
  | "MultiSeries"
  | "BatchResults"
  | "PlotBundle"
  | "Scalar"
  | "Any";

export interface PortDef {
  readonly id: string;
  readonly name: string;
  readonly type: PortType;
  readonly direction: "in" | "out";
}

/* ── Port compatibility ── */
const COMPATIBLE_PORTS: Record<PortType, readonly PortType[]> = {
  CableParams: ["CableParams"],
  WMMParams:   ["WMMParams"],
  Grid2D:      ["Grid2D"],
  Series1D:    ["Series1D"],
  PolarData:   ["PolarData"],
  GeoData:     ["GeoData"],
  MultiSeries: ["MultiSeries", "Series1D"],
  BatchResults:["BatchResults"],
  PlotBundle:  ["PlotBundle", "Grid2D", "Series1D", "PolarData"],
  Scalar:      ["Scalar"],
  Any:         [
    "CableParams", "WMMParams", "Grid2D", "Series1D", "PolarData",
    "GeoData", "MultiSeries", "BatchResults", "PlotBundle", "Scalar", "Any",
  ],
};

export function canConnect(from: PortDef, to: PortDef): boolean {
  if (from.direction !== "out" || to.direction !== "in") return false;
  if (to.type === "Any") return true;
  return COMPATIBLE_PORTS[from.type]?.includes(to.type) ?? false;
}

/* ── Node categories ── */
export type NodeCategory = "source" | "compute" | "transform" | "visualize" | "output";

/* ── Static node definition (from registry) ── */
export interface WorkflowNodeDef {
  readonly type: string;
  readonly category: NodeCategory;
  readonly title: string;
  readonly description: string;
  readonly iconName: string;      // lucide icon name
  readonly color: string;         // tailwind color key
  readonly ports: readonly PortDef[];
  readonly configFields?: readonly ConfigField[];
}

export interface ConfigField {
  readonly key: string;
  readonly label: string;
  readonly type: "text" | "number" | "select" | "file";
  readonly options?: readonly string[];
  readonly defaultValue?: string | number;
}

/* ── Runtime node instance ── */
export type NodeStatus = "idle" | "running" | "done" | "error";

export interface WorkflowNodeInstance {
  readonly id: string;
  readonly defType: string;
  readonly position: { readonly x: number; readonly y: number };
  readonly config: Record<string, unknown>;
  readonly status: NodeStatus;
  readonly outputData?: Record<string, unknown>;
  readonly errorMessage?: string;
}

/* ── Connections ── */
export interface WorkflowConnection {
  readonly id: string;
  readonly fromNodeId: string;
  readonly fromPortId: string;
  readonly toNodeId: string;
  readonly toPortId: string;
}

/* ── Full graph ── */
export interface WorkflowGraph {
  readonly nodes: readonly WorkflowNodeInstance[];
  readonly connections: readonly WorkflowConnection[];
}

/* ── Port color mapping for UI ── */
export const PORT_COLORS: Record<PortType, string> = {
  CableParams:  "#f472b6", // pink
  WMMParams:    "#a78bfa", // purple
  Grid2D:       "#60a5fa", // blue
  Series1D:     "#34d399", // green
  PolarData:    "#f472b6", // pink
  GeoData:      "#2dd4bf", // teal
  MultiSeries:  "#818cf8", // indigo
  BatchResults: "#a3e635", // lime
  PlotBundle:   "#c084fc", // violet
  Scalar:       "#fbbf24", // amber
  Any:          "#888888", // gray
};
