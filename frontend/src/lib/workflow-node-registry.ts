/**
 * Node registry — static definitions for all 15 v1 node types.
 * Each entry defines ports, icons, colors, and optional config fields.
 */

import type {
  WorkflowNodeDef,
  PortDef,
  NodeCategory,
  ConfigField,
  canConnect as _canConnect,
} from "@/types/workflow-nodes";
import { canConnect } from "@/types/workflow-nodes";

/* ── Helper: build port defs concisely ── */
function outPort(id: string, name: string, type: PortDef["type"]): PortDef {
  return { id, name, type, direction: "out" } as const;
}
function inPort(id: string, name: string, type: PortDef["type"]): PortDef {
  return { id, name, type, direction: "in" } as const;
}

/* ── Source Nodes ── */

const hvacFile: WorkflowNodeDef = {
  type: "hvac-file",
  category: "source",
  title: "HVAC",
  description: "Link to an HVAC cable file",
  iconName: "Cable",
  color: "rose",
  ports: [outPort("params", "Params", "CableParams")],
  configFields: [
    { key: "fileId", label: "File", type: "file" },
  ],
};

const dcBipoleFile: WorkflowNodeDef = {
  type: "dc-bipole-file",
  category: "source",
  title: "DC BIPOLE",
  description: "Link to a DC Bipole cable file",
  iconName: "Zap",
  color: "yellow",
  ports: [outPort("params", "Params", "CableParams")],
  configFields: [
    { key: "fileId", label: "File", type: "file" },
  ],
};

const wmmFile: WorkflowNodeDef = {
  type: "wmm-file",
  category: "source",
  title: "WMM",
  description: "Link to a WMM geomag file",
  iconName: "Globe",
  color: "purple",
  ports: [outPort("params", "Params", "WMMParams")],
  configFields: [
    { key: "fileId", label: "File", type: "file" },
  ],
};

const batchFolder: WorkflowNodeDef = {
  type: "batch-folder",
  category: "source",
  title: "Batch Folder",
  description: "Link to existing batch results",
  iconName: "FolderOpen",
  color: "lime",
  ports: [outPort("results", "Results", "BatchResults")],
  configFields: [
    { key: "batchId", label: "Batch", type: "file" },
  ],
};

/* ── Compute Nodes ── */

const singleRun: WorkflowNodeDef = {
  type: "single-run",
  category: "compute",
  title: "Single Run",
  description: "Execute one calculation",
  iconName: "Play",
  color: "emerald",
  ports: [
    inPort("params", "Params", "CableParams"),
    outPort("plots", "Plots", "PlotBundle"),
  ],
};

const batchSweep: WorkflowNodeDef = {
  type: "batch-sweep",
  category: "compute",
  title: "Batch Sweep",
  description: "Run parameter sweep",
  iconName: "Layers",
  color: "blue",
  ports: [
    inPort("params", "Params", "CableParams"),
    outPort("results", "Results", "BatchResults"),
  ],
};

const locationTransect: WorkflowNodeDef = {
  type: "location-transect",
  category: "compute",
  title: "Location Transect",
  description: "Run along geographic route",
  iconName: "MapPin",
  color: "cyan",
  ports: [
    inPort("params", "Params", "CableParams"),
    inPort("geo", "Geo", "GeoData"),
    outPort("results", "Results", "BatchResults"),
  ],
};

/* ── Transform Nodes ── */

const sliceNode: WorkflowNodeDef = {
  type: "slice",
  category: "transform",
  title: "Slice",
  description: "Extract line from 2D grid",
  iconName: "Scissors",
  color: "amber",
  ports: [
    inPort("grid", "Grid", "Grid2D"),
    outPort("series", "Series", "Series1D"),
  ],
  configFields: [
    { key: "axis", label: "Axis", type: "select", options: ["row", "column", "diagonal"], defaultValue: "row" },
    { key: "index", label: "Index", type: "number", defaultValue: 0 },
  ],
};

const thresholdNode: WorkflowNodeDef = {
  type: "threshold",
  category: "transform",
  title: "Threshold",
  description: "Mask values above/below limit",
  iconName: "Filter",
  color: "red",
  ports: [
    inPort("grid", "Grid", "Grid2D"),
    outPort("filtered", "Filtered", "Grid2D"),
  ],
  configFields: [
    { key: "operator", label: "Operator", type: "select", options: [">", "<", ">=", "<="], defaultValue: ">" },
    { key: "value", label: "Value", type: "number", defaultValue: 1 },
  ],
};

const mergeNode: WorkflowNodeDef = {
  type: "merge",
  category: "transform",
  title: "Merge",
  description: "Combine line plots",
  iconName: "Merge",
  color: "indigo",
  ports: [
    inPort("a", "Series A", "Series1D"),
    inPort("b", "Series B", "Series1D"),
    outPort("merged", "Merged", "MultiSeries"),
  ],
};

/* ── Visualize Nodes ── */

const heatmapNode: WorkflowNodeDef = {
  type: "heatmap",
  category: "visualize",
  title: "Heatmap",
  description: "2D color-mapped surface",
  iconName: "Grid3X3",
  color: "violet",
  ports: [inPort("grid", "Grid", "Grid2D")],
  configFields: [
    { key: "colorscale", label: "Colorscale", type: "select", options: ["viridis", "plasma", "inferno", "magma", "coolwarm"], defaultValue: "viridis" },
  ],
};

const lineChartNode: WorkflowNodeDef = {
  type: "line-chart",
  category: "visualize",
  title: "Line Chart",
  description: "1D line or multi-series plot",
  iconName: "LineChart",
  color: "sky",
  ports: [inPort("data", "Data", "Series1D")],
};

const polarChartNode: WorkflowNodeDef = {
  type: "polar-chart",
  category: "visualize",
  title: "Polar Chart",
  description: "Azimuthal profile",
  iconName: "Radar",
  color: "pink",
  ports: [inPort("data", "Data", "PolarData")],
};

const geoMapNode: WorkflowNodeDef = {
  type: "geo-map",
  category: "visualize",
  title: "Geographic Map",
  description: "WMM data on world map",
  iconName: "Map",
  color: "teal",
  ports: [inPort("data", "Data", "GeoData")],
};

/* ── Output Nodes ── */

const exportNode: WorkflowNodeDef = {
  type: "export",
  category: "output",
  title: "Export",
  description: "Download PNG / CSV / PDF",
  iconName: "Download",
  color: "gray",
  ports: [inPort("data", "Data", "Any")],
  configFields: [
    { key: "format", label: "Format", type: "select", options: ["png", "csv", "pdf"], defaultValue: "png" },
  ],
};

/* ── Batch Source Nodes (loaded from batch explorer) ── */

const batchHvacMixed: WorkflowNodeDef = {
  type: "batch-hvac-mixed",
  category: "source",
  title: "BATCH HVAC (M)",
  description: "HVAC batch — magnetic + non-magnetic",
  iconName: "Layers",
  color: "red",
  ports: [outPort("results", "Results", "BatchResults")],
};

const batchHvacNonMag: WorkflowNodeDef = {
  type: "batch-hvac-nonmag",
  category: "source",
  title: "BATCH HVAC (NM)",
  description: "HVAC batch — non-magnetic only",
  iconName: "Layers",
  color: "white",
  ports: [outPort("results", "Results", "BatchResults")],
};

const batchDcCable: WorkflowNodeDef = {
  type: "batch-dc-cable",
  category: "source",
  title: "BATCH DC BIPOLE (C)",
  description: "DC Bipole batch — cable mode",
  iconName: "Layers",
  color: "yellow",
  ports: [outPort("results", "Results", "BatchResults")],
};

const batchDcLocation: WorkflowNodeDef = {
  type: "batch-dc-location",
  category: "source",
  title: "BATCH DC BIPOLE (L)",
  description: "DC Bipole batch — location mode",
  iconName: "Layers",
  color: "purple",
  ports: [outPort("results", "Results", "BatchResults")],
};

/* ── Registry ── */

export const NODE_REGISTRY: Record<string, WorkflowNodeDef> = {
  "hvac-file":          hvacFile,
  "dc-bipole-file":     dcBipoleFile,
  "wmm-file":           wmmFile,
  "batch-folder":       batchFolder,
  "batch-hvac-mixed":   batchHvacMixed,
  "batch-hvac-nonmag":  batchHvacNonMag,
  "batch-dc-cable":     batchDcCable,
  "batch-dc-location":  batchDcLocation,
  "single-run":         singleRun,
  "batch-sweep":        batchSweep,
  "location-transect":  locationTransect,
  "slice":              sliceNode,
  "threshold":          thresholdNode,
  "merge":              mergeNode,
  "heatmap":            heatmapNode,
  "line-chart":         lineChartNode,
  "polar-chart":        polarChartNode,
  "geo-map":            geoMapNode,
  "export":             exportNode,
};

export function getNodeDef(type: string): WorkflowNodeDef | undefined {
  return NODE_REGISTRY[type];
}

/* ── Palette for add-node menu, grouped by category ── */

export type NodePaletteGroup = {
  readonly category: NodeCategory;
  readonly label: string;
  readonly types: readonly string[];
};

export const NODE_PALETTE: readonly NodePaletteGroup[] = [
  // Sources removed from palette — files load from work tree via --> button
  { category: "compute",   label: "Compute",    types: ["single-run", "batch-sweep", "location-transect"] },
  { category: "transform", label: "Transform",  types: ["slice", "threshold", "merge"] },
  { category: "visualize", label: "Visualize",  types: ["heatmap", "line-chart", "polar-chart", "geo-map"] },
  { category: "output",    label: "Output",     types: ["export"] },
] as const;

/* ── Re-export canConnect for convenience ── */
export { canConnect };
