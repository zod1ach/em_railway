/**
 * Workflow DAG executor — topological sort + async node execution.
 * Compute nodes call backend, transform nodes run client-side.
 */

import type {
  WorkflowGraph,
  WorkflowNodeInstance,
  WorkflowConnection,
} from "@/types/workflow-nodes";
import { getNodeDef } from "./workflow-node-registry";
import type { CanvasAction } from "./workflow-canvas-reducer";

const API_BASE = "http://localhost:8000";

/* ── Topological Sort (Kahn's algorithm) ── */

export function topologicalSort(graph: WorkflowGraph): string[] {
  const { nodes, connections } = graph;
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const conn of connections) {
    const prev = inDegree.get(conn.toNodeId) ?? 0;
    inDegree.set(conn.toNodeId, prev + 1);
    const adj = adjacency.get(conn.fromNodeId) ?? [];
    adj.push(conn.toNodeId);
    adjacency.set(conn.fromNodeId, adj);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjacency.get(current) ?? []) {
      const deg = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  // If sorted length !== nodes length, there's a cycle
  if (sorted.length !== nodes.length) {
    throw new Error("Workflow contains a cycle — cannot execute.");
  }

  return sorted;
}

/* ── Detect cycles ── */

export function hasCycle(graph: WorkflowGraph): boolean {
  try {
    topologicalSort(graph);
    return false;
  } catch {
    return true;
  }
}

/* ── Get upstream outputs for a node ── */

function getUpstreamOutputs(
  nodeId: string,
  graph: WorkflowGraph,
  outputCache: Map<string, Record<string, unknown>>
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const conn of graph.connections) {
    if (conn.toNodeId === nodeId) {
      const upstream = outputCache.get(conn.fromNodeId);
      if (upstream) {
        inputs[conn.toPortId] = upstream[conn.fromPortId] ?? upstream;
      }
    }
  }
  return inputs;
}

/* ── Execute a single source node ── */

async function executeSourceNode(
  node: WorkflowNodeInstance
): Promise<Record<string, unknown>> {
  // Source nodes already have their file data loaded via onFileSelect in the config panel.
  // The data is pre-populated in node.outputData when a file is selected.
  if (node.outputData) return node.outputData;
  return { params: node.config };
}

/* ── Execute a single compute node ── */

async function executeComputeNode(
  node: WorkflowNodeInstance,
  inputs: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const def = getNodeDef(node.defType);
  if (!def) throw new Error(`Unknown node type: ${node.defType}`);

  let endpoint = "";
  const rawParams = inputs.params as Record<string, unknown> ?? {};

  // Separate metadata from calculation params
  const cableType = rawParams.cable_type as string ?? "hvac";
  const magnetic = rawParams.magnetic as boolean ?? false;
  const { cable_type: _ct, file_name: _fn, magnetic: _mg, ...calcParams } = rawParams;

  switch (node.defType) {
    case "single-run": {
      if (cableType === "hvac") {
        endpoint = magnetic
          ? "/api/hvac-mag/calculate"
          : "/api/hvac-nonmag/calculate";
      } else if (cableType === "dc_bipole") {
        endpoint = "/api/dc-bipole/calculate";
      } else {
        endpoint = "/api/hvac-nonmag/calculate";
      }
      break;
    }
    case "batch-sweep":
    case "location-transect":
      // These use the batch API — placeholder for now
      return { results: { message: "Batch execution not yet wired" } };
    default:
      throw new Error(`Unknown compute type: ${node.defType}`);
  }

  const paramCount = Object.keys(calcParams).length;
  const url = `${API_BASE}${endpoint}`;
  const t0 = performance.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calcParams),
    });
  } catch (netErr) {
    const elapsed = Math.round(performance.now() - t0);
    const msg = netErr instanceof Error ? netErr.message : String(netErr);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
      throw new Error(`Network error: ${endpoint} (${elapsed}ms) — connection refused or timeout. Is the backend running?`);
    }
    throw new Error(`Network error: ${endpoint} (${elapsed}ms) — ${msg}`);
  }

  const elapsed = Math.round(performance.now() - t0);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} ${endpoint} (${elapsed}ms) — ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const responseSize = JSON.stringify(data).length;

  return {
    plots: data,
    _meta: {
      endpoint,
      paramCount,
      statusCode: response.status,
      responseTimeMs: elapsed,
      responseSizeBytes: responseSize,
    },
  };
}

/* ── Execute a single transform node ── */

function executeTransformNode(
  node: WorkflowNodeInstance,
  inputs: Record<string, unknown>
): Record<string, unknown> {
  switch (node.defType) {
    case "slice": {
      const grid = inputs.grid as { x: number[]; y: number[]; z: number[][] } | undefined;
      if (!grid) return { series: null };
      const axis = (node.config.axis as string) ?? "row";
      const index = Number(node.config.index ?? 0);
      if (axis === "row" && grid.z[index]) {
        return { series: { x: grid.x, y: grid.z[index], label: `Row ${index}` } };
      }
      if (axis === "column") {
        const col = grid.z.map((row) => row[index] ?? 0);
        return { series: { x: grid.y, y: col, label: `Col ${index}` } };
      }
      return { series: null };
    }

    case "threshold": {
      const grid = inputs.grid as { x: number[]; y: number[]; z: number[][] } | undefined;
      if (!grid) return { filtered: null };
      const op = (node.config.operator as string) ?? ">";
      const val = Number(node.config.value ?? 1);
      const compare = (a: number): boolean => {
        switch (op) {
          case ">": return a > val;
          case "<": return a < val;
          case ">=": return a >= val;
          case "<=": return a <= val;
          default: return a > val;
        }
      };
      const filtered = grid.z.map((row) =>
        row.map((v) => (compare(v) ? v : NaN))
      );
      return { filtered: { ...grid, z: filtered } };
    }

    case "merge": {
      const a = inputs.a as { x: number[]; y: number[]; label?: string } | undefined;
      const b = inputs.b as { x: number[]; y: number[]; label?: string } | undefined;
      const series = [];
      if (a) series.push(a);
      if (b) series.push(b);
      return { merged: { series } };
    }

    default:
      return {};
  }
}

/* ── Extract plots for visualize nodes from upstream compute output ── */

function extractVisualizePlots(
  node: WorkflowNodeInstance,
  inputs: Record<string, unknown>
): Record<string, unknown> {
  // Input might come on any port — check all inputs for plot data
  for (const val of Object.values(inputs)) {
    if (!val || typeof val !== "object") continue;
    const obj = val as Record<string, unknown>;

    // Compute node output: { status, plots: { key: PlotData }, results }
    if (obj.plots && typeof obj.plots === "object") {
      const plotsMap = obj.plots as Record<string, unknown>;
      const plotList = Object.values(plotsMap);

      // Filter by visualize node type
      switch (node.defType) {
        case "heatmap": {
          const heatmap = plotList.find((p: any) => p?.type === "heatmap");
          if (heatmap) return { plots: { plots: { surface: heatmap } } };
          // Return all heatmaps if no single match
          const heatmaps: Record<string, unknown> = {};
          for (const [k, p] of Object.entries(plotsMap)) {
            if ((p as any)?.type === "heatmap") heatmaps[k] = p;
          }
          if (Object.keys(heatmaps).length > 0) return { plots: { plots: heatmaps } };
          break;
        }
        case "line-chart": {
          const lines: Record<string, unknown> = {};
          for (const [k, p] of Object.entries(plotsMap)) {
            if ((p as any)?.type === "line" || (p as any)?.type === "multi_line") lines[k] = p;
          }
          if (Object.keys(lines).length > 0) return { plots: { plots: lines } };
          break;
        }
        case "polar-chart": {
          const polars: Record<string, unknown> = {};
          for (const [k, p] of Object.entries(plotsMap)) {
            if ((p as any)?.type === "polar") polars[k] = p;
          }
          if (Object.keys(polars).length > 0) return { plots: { plots: polars } };
          break;
        }
        default:
          return { plots: obj };
      }
    }
  }

  // Fallback: pass inputs through
  return inputs;
}

/* ── Main graph executor ── */

export async function executeGraph(
  graph: WorkflowGraph,
  dispatch: (action: CanvasAction) => void
): Promise<void> {
  // Cycle detection
  let sorted: string[];
  try {
    sorted = topologicalSort(graph);
  } catch {
    throw new Error("Circular dependency detected in workflow graph — cannot execute");
  }

  const outputCache = new Map<string, Record<string, unknown>>();

  for (const nodeId of sorted) {
    const node = graph.nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    const def = getNodeDef(node.defType);
    if (!def) {
      dispatch({ type: "SET_NODE_STATUS", payload: { nodeId, status: "error", errorMessage: `Node definition not found: ${node.defType}` } });
      continue;
    }

    dispatch({ type: "SET_NODE_STATUS", payload: { nodeId, status: "running" } });
    const nodeStart = performance.now();

    try {
      const inputs = getUpstreamOutputs(nodeId, graph, outputCache);
      let output: Record<string, unknown>;

      switch (def.category) {
        case "source":
          output = await executeSourceNode(node);
          // Check if source node has data
          if (!output || (Object.keys(output).length === 0)) {
            throw new Error(`File data missing for source node — no data loaded`);
          }
          if (output.params && Object.keys(output.params as object).length === 0) {
            throw new Error(`File data empty for source node — load a file first`);
          }
          break;
        case "compute":
          output = await executeComputeNode(node, inputs);
          break;
        case "transform":
          output = executeTransformNode(node, inputs);
          break;
        case "visualize":
          output = extractVisualizePlots(node, inputs);
          break;
        case "output":
          output = inputs;
          break;
        default:
          output = {};
      }

      const nodeElapsed = Math.round(performance.now() - nodeStart);
      outputCache.set(nodeId, output);
      dispatch({ type: "SET_NODE_OUTPUT", payload: { nodeId, outputData: { ...output, _nodeTimeMs: nodeElapsed }, markDone: true } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      dispatch({ type: "SET_NODE_STATUS", payload: { nodeId, status: "error", errorMessage: msg } });

      // Mark all downstream nodes as error
      const downstream = getDownstreamNodes(nodeId, graph);
      for (const dId of downstream) {
        dispatch({
          type: "SET_NODE_STATUS",
          payload: { nodeId: dId, status: "error", errorMessage: `Upstream node ${nodeId} failed` },
        });
      }
    }
  }
}

/* ── Get all downstream node IDs ── */

function getDownstreamNodes(nodeId: string, graph: WorkflowGraph): string[] {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const conn of graph.connections) {
      if (conn.fromNodeId === current && !visited.has(conn.toNodeId)) {
        visited.add(conn.toNodeId);
        queue.push(conn.toNodeId);
      }
    }
  }
  return [...visited];
}
