/**
 * Right 1/3 panel — renders D3Plot for selected node output.
 * Works for both visualize nodes and compute nodes that have plot data.
 */

import { useMemo, useState } from "react";
import type { WorkflowNodeInstance } from "@/types/workflow-nodes";
import { getNodeDef } from "@/lib/workflow-node-registry";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { D3Plot, type PlotData } from "@/components/D3Plot";

interface Props {
  nodes: readonly WorkflowNodeInstance[];
  selectedNodeId: string | null;
}

/* ── Extract all renderable plots from a node's output ── */
function extractPlots(output: Record<string, unknown> | undefined): PlotData[] {
  if (!output) return [];
  const plots: PlotData[] = [];

  // Compute node: output = { plots: { status, plots: { key: PlotData, ... }, results } }
  const plotsBundle = output.plots as Record<string, unknown> | undefined;
  if (plotsBundle) {
    const innerPlots = plotsBundle.plots as Record<string, unknown> | undefined;
    if (innerPlots) {
      for (const val of Object.values(innerPlots)) {
        if (val && typeof val === "object" && "type" in val) {
          plots.push(val as PlotData);
        }
      }
    }
    // Maybe plotsBundle itself is a PlotData
    if ("type" in plotsBundle && (plotsBundle.type === "heatmap" || plotsBundle.type === "line" || plotsBundle.type === "multi_line")) {
      plots.push(plotsBundle as PlotData);
    }
  }

  // Visualize node: input might be a grid directly
  if (output.grid && typeof output.grid === "object" && "type" in (output.grid as object)) {
    plots.push(output.grid as PlotData);
  }
  if (output.data && typeof output.data === "object" && "type" in (output.data as object)) {
    plots.push(output.data as PlotData);
  }

  // Transform node: might have series output
  if (output.series && typeof output.series === "object") {
    const s = output.series as Record<string, unknown>;
    if (s.x && s.y) {
      plots.push({
        type: "line",
        title: (s.label as string) ?? "Slice",
        xlabel: "x",
        ylabel: "y",
        x: s.x as number[],
        y: s.y as number[],
      });
    }
  }

  return plots;
}

export function WorkflowPlotPanel({ nodes, selectedNodeId }: Props) {
  const [activePlotIndex, setActivePlotIndex] = useState(0);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return nodes.find((n) => n.id === selectedNodeId) ?? null;
  }, [nodes, selectedNodeId]);

  const def = selectedNode ? getNodeDef(selectedNode.defType) : null;
  const hasOutput = selectedNode?.status === "done" && !!selectedNode.outputData;
  const plots = useMemo(() => extractPlots(selectedNode?.outputData), [selectedNode?.outputData]);

  // Reset active index when plots change
  const clampedIndex = activePlotIndex >= plots.length ? 0 : activePlotIndex;

  return (
    <div className="relative flex h-full w-full flex-col rounded-r-lg border border-l-0 border-[#1a1a1a] bg-[#080808]">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <FlickeringGrid
          color="rgb(255, 255, 255)"
          maxOpacity={0.05}
          flickerChance={0.1}
          squareSize={2}
          gridGap={8}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-[#1a1a1a] px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#555]">
          {def ? def.title : "Plots"}
        </span>
        {hasOutput && plots.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span className="text-[9px] uppercase tracking-[0.15em] text-emerald-400">
              {plots.length} {plots.length === 1 ? "Plot" : "Plots"}
            </span>
          </div>
        )}
      </div>

      {/* Plot tabs — if multiple plots */}
      {plots.length > 1 && (
        <div className="relative z-10 flex gap-1 overflow-x-auto border-b border-[#1a1a1a] px-2 py-1">
          {plots.map((p, i) => (
            <button
              key={i}
              onClick={() => setActivePlotIndex(i)}
              className={`cursor-none whitespace-nowrap rounded px-2 py-0.5 text-[9px] uppercase tracking-[0.15em] transition-colors ${
                i === clampedIndex
                  ? "bg-white/10 text-white"
                  : "text-[#555] hover:text-[#999]"
              }`}
            >
              {p.title?.slice(0, 20) ?? `Plot ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-auto p-2">
        {!selectedNode && (
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#333]">
              Select a node to view output
            </span>
          </div>
        )}

        {selectedNode && !hasOutput && (
          <div className="flex h-full items-center justify-center text-center">
            <div>
              <span className="block text-[10px] uppercase tracking-[0.25em] text-[#333]">
                No output yet
              </span>
              <span className="mt-1 block text-[9px] text-[#555]">
                Run the workflow to generate plots
              </span>
            </div>
          </div>
        )}

        {hasOutput && plots.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <span className="text-[10px] uppercase tracking-[0.25em] text-[#333]">
              No renderable plots in output
            </span>
          </div>
        )}

        {hasOutput && plots.length > 0 && (
          <D3Plot data={plots[clampedIndex]} height={340} />
        )}
      </div>
    </div>
  );
}
