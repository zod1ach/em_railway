/**
 * Workflow Canvas — N8N-style flow builder with typed domain-specific nodes.
 * Uses canvasReducer for state, WorkflowNodeCard for rendering, and port-based connections.
 */

import { motion, type PanInfo } from "motion/react";
import { useReducer, useRef, useState, useCallback, useImperativeHandle, forwardRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { Play } from "lucide-react";
import { WorkflowConsolePanel } from "./workflow-console-panel";
import { createLogEntry, type LogEntry } from "@/lib/workflow-console";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { WorkflowNodeCard, NODE_WIDTH_SINGLE, NODE_HEIGHT, getNodeWidth } from "./workflow-node-card";
import { WorkflowAddNodeMenu } from "./workflow-add-node-menu";
import { WorkflowPlotPanel } from "./workflow-plot-panel";
import { WorkflowDetailsPanel } from "./workflow-details-panel";
import { WorkflowRunsTableModal } from "./workflow-runs-table-modal";
// WorkflowNodeConfig removed — files load via tree --> button
import { canvasReducer, createInitialCanvasState, type CanvasAction } from "@/lib/workflow-canvas-reducer";
import { getNodeDef } from "@/lib/workflow-node-registry";
import { executeGraph } from "@/lib/workflow-executor";
import type { WorkflowNodeInstance } from "@/types/workflow-nodes";
import { canConnect } from "@/types/workflow-nodes";
import type { ProjectFile } from "@/types/project-files";
import {
  getLocalFileData,
  getTeamFileData,
} from "@/lib/project-files";

export interface WorkflowCanvasHandle {
  addFileNode: (file: ProjectFile, fileData: Record<string, any>) => void;
  addBatchNode: (defType: string, fileIds: string[], label: string, batchInfo?: Record<string, any>) => void;
  getLoadedFileIds: () => string[];
  logMessage: (level: "output" | "error", message: string) => void;
}

interface WorkflowCanvasProps {
  projectId: string;
  projectType: "local" | "team";
  files: ProjectFile[];
}

/* ── Connection line between ports ── */
function PortConnectionLine({
  fromNode,
  toNode,
  isRunning,
}: {
  fromNode: WorkflowNodeInstance;
  toNode: WorkflowNodeInstance;
  isRunning: boolean;
}) {
  const startX = fromNode.position.x + getNodeWidth(fromNode.defType);
  const startY = fromNode.position.y + NODE_HEIGHT / 2;
  const endX = toNode.position.x;
  const endY = toNode.position.y + NODE_HEIGHT / 2;
  const cp1X = startX + (endX - startX) * 0.5;
  const cp2X = endX - (endX - startX) * 0.5;
  const path = `M${startX},${startY} C${cp1X},${startY} ${cp2X},${endY} ${endX},${endY}`;

  return (
    <path
      d={path}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeDasharray={isRunning ? "4,4" : "8,6"}
      strokeLinecap="round"
      opacity={isRunning ? 0.6 : 0.35}
      className="text-white"
    >
      {isRunning && (
        <animate
          attributeName="stroke-dashoffset"
          values="0;-16"
          dur="0.5s"
          repeatCount="indefinite"
        />
      )}
    </path>
  );
}

/* ── Main Canvas ── */
export const WorkflowCanvas = forwardRef<WorkflowCanvasHandle, WorkflowCanvasProps>(
  function WorkflowCanvas({ projectId, projectType, files }, ref) {
  const storageKey = `electrofish_canvas_${projectId}`;

  const [state, dispatch] = useReducer(canvasReducer, undefined, () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.nodes && parsed.connections) {
          // Log on next tick since log isn't ready yet
          setTimeout(() => logRef.current?.("output",
            `State restored from localStorage — ${parsed.nodes.length} nodes, ${parsed.connections.length} connections`), 0);
          return {
            nodes: parsed.nodes,
            connections: parsed.connections,
            selectedNodeId: null,
            connectingFromPort: null,
            _undoStack: [],
          };
        }
      }
    } catch {
      setTimeout(() => logRef.current?.("error", "localStorage data corrupt — reset to empty"), 0);
    }
    return createInitialCanvasState();
  });

  // Console logs
  const [consoleLogs, setConsoleLogs] = useState<LogEntry[]>([]);
  const log = useCallback((level: "output" | "error", message: string) => {
    // Prefix with $ like a terminal, indent continuation lines
    const prefix = message.startsWith("  ") ? "  " : "$ ";
    setConsoleLogs((prev) => [...prev.slice(-500), createLogEntry(level, `${prefix}${message.trimStart()}`)]);
  }, []);
  const logRef = useRef<typeof log | null>(null);
  logRef.current = log;

  /* ── Helper: resolve node display name ── */
  const nodeName = useCallback((nodeId: string): string => {
    const n = state.nodes.find((nd) => nd.id === nodeId);
    if (!n) return nodeId;
    const d = getNodeDef(n.defType);
    const fileName = n.outputData?.params ? (n.outputData.params as Record<string, unknown>).file_name as string : null;
    return fileName ? `${d?.title ?? n.defType} (${fileName})` : (d?.title ?? n.defType);
  }, [state.nodes]);

  /* ── Logging dispatch wrapper — super detailed ── */
  const prevStateRef = useRef(state);
  prevStateRef.current = state;
  const loggedDispatch = useCallback((action: CanvasAction) => {
    const prevState = prevStateRef.current;
    dispatch(action);

    switch (action.type) {
      case "ADD_NODE": {
        const d = getNodeDef(action.payload.defType);
        const { x, y } = action.payload.position;
        log("output", `+ Node added: ${d?.title ?? action.payload.defType} at (${Math.round(x)}, ${Math.round(y)})`);
        break;
      }
      case "REMOVE_NODE": {
        const name = nodeName(action.payload.nodeId);
        const connCount = prevState.connections.filter(
          (c) => c.fromNodeId === action.payload.nodeId || c.toNodeId === action.payload.nodeId
        ).length;
        log("output", `− Node removed: ${name}${connCount > 0 ? ` (${connCount} connection${connCount > 1 ? "s" : ""} removed)` : ""}`);
        break;
      }
      case "FINISH_CONNECTING": {
        const from = prevState.connectingFromPort;
        if (!from) break;

        const fromName = nodeName(from.nodeId);
        const toName = nodeName(action.payload.nodeId);
        const fromDef = getNodeDef(prevState.nodes.find((n) => n.id === from.nodeId)?.defType ?? "");
        const toDef = getNodeDef(prevState.nodes.find((n) => n.id === action.payload.nodeId)?.defType ?? "");
        const fromPort = fromDef?.ports.find((p) => p.id === from.portId);
        const toPort = toDef?.ports.find((p) => p.id === action.payload.portId);

        // Check rejection reasons
        if (from.nodeId === action.payload.nodeId) {
          log("error", `Connection rejected: self-connection not allowed (${fromName})`);
          break;
        }
        const isDuplicate = prevState.connections.some(
          (c) => c.fromNodeId === from.nodeId && c.fromPortId === from.portId
            && c.toNodeId === action.payload.nodeId && c.toPortId === action.payload.portId
        );
        if (isDuplicate) {
          log("error", `Connection rejected: duplicate connection ${fromName} → ${toName}`);
          break;
        }
        if (fromPort && toPort) {
          if (!canConnect(fromPort, toPort)) {
            log("error", `Connection rejected: type mismatch — ${fromPort.type} ≠ ${toPort.type}`);
            log("error", `  ${fromName}:${fromPort.name} (${fromPort.type}) → ${toName}:${toPort.name} (${toPort.type})`);
            break;
          }
          log("output", `Connected: ${fromName}:${fromPort.name} (${fromPort.type}) → ${toName}:${toPort.name} (${toPort.type})`);
        } else {
          log("output", `Connected: ${fromName} → ${toName}`);
        }
        log("output", `  Total connections: ${prevState.connections.length + 1}`);
        break;
      }
      case "START_CONNECTING": {
        const name = nodeName(action.payload.nodeId);
        const d = getNodeDef(prevState.nodes.find((n) => n.id === action.payload.nodeId)?.defType ?? "");
        const port = d?.ports.find((p) => p.id === action.payload.portId);
        log("output", `Connection started: ${name}:${port?.name ?? action.payload.portId} (${port?.type ?? "?"})`);
        break;
      }
      case "REMOVE_CONNECTION": {
        const conn = prevState.connections.find((c) => c.id === action.payload.connectionId);
        if (conn) {
          const fromName = nodeName(conn.fromNodeId);
          const toName = nodeName(conn.toNodeId);
          log("output", `Connection removed: ${fromName} → ${toName}`);
        } else {
          log("output", `Connection removed`);
        }
        break;
      }
      case "UPDATE_NODE_CONFIG": {
        const name = nodeName(action.payload.nodeId);
        const oldNode = prevState.nodes.find((n) => n.id === action.payload.nodeId);
        const changes: string[] = [];
        for (const [k, v] of Object.entries(action.payload.config)) {
          const oldVal = oldNode?.config?.[k];
          if (oldVal !== undefined && oldVal !== v) {
            changes.push(`${k}: ${oldVal} -> ${v}`);
          } else if (oldVal === undefined) {
            changes.push(`${k}: (new) ${v}`);
          }
        }
        if (changes.length > 0) {
          log("output", `Config updated: ${name}`);
          for (const c of changes) {
            log("output", `  ${c}`);
          }
        } else {
          log("output", `Config updated: ${name} — fields: ${Object.keys(action.payload.config).join(", ")}`);
        }
        break;
      }
      case "SET_NODE_STATUS": {
        const name = nodeName(action.payload.nodeId);
        const s = action.payload.status;
        if (s === "running") log("output", `Executing: ${name}`);
        if (s === "done") log("output", `Completed: ${name}`);
        if (s === "idle") log("output", `Reset: ${name}`);
        if (s === "error") {
          log("error", `Failed: ${name}`);
          if (action.payload.errorMessage) {
            log("error", `  Error: ${action.payload.errorMessage}`);
          }
        }
        break;
      }
      case "SET_NODE_OUTPUT": {
        const name = nodeName(action.payload.nodeId);
        const data = action.payload.outputData;

        // Per-node execution time
        const nodeTime = data._nodeTimeMs as number | undefined;
        if (nodeTime !== undefined) {
          log("output", `  Execution time: ${nodeTime}ms`);
        }

        // API metadata from compute nodes
        const meta = data._meta as Record<string, unknown> | undefined;
        if (meta) {
          log("output", `API: POST ${meta.endpoint} — ${meta.statusCode} (${meta.responseTimeMs}ms)`);
          log("output", `  Params: ${meta.paramCount} fields | Response: ${((meta.responseSizeBytes as number) / 1024).toFixed(1)} KB`);
        }

        const plotsBundle = data.plots as Record<string, unknown> | undefined;
        if (plotsBundle) {
          const innerPlots = plotsBundle.plots as Record<string, unknown> | undefined;
          if (innerPlots) {
            const plotKeys = Object.keys(innerPlots);
            log("output", `Output: ${name} — ${plotKeys.length} plot${plotKeys.length > 1 ? "s" : ""}`);
            for (const key of plotKeys) {
              const p = innerPlots[key] as Record<string, unknown>;
              const pType = p?.type as string ?? "unknown";
              log("output", `  └ ${key}: ${pType}`);
            }
          } else {
            log("output", `Output: ${name}`);
          }
          const results = plotsBundle.results as Record<string, unknown> | undefined;
          if (results) {
            for (const [k, v] of Object.entries(results)) {
              const formatted = typeof v === "number" ? v.toExponential(3) : String(v);
              log("output", `  ${k}: ${formatted}`);
            }
          }
        } else {
          log("output", `Output: ${name}`);
        }
        break;
      }
      case "CLEAR_ALL":
        log("output", `Canvas cleared — removed ${prevState.nodes.length} nodes, ${prevState.connections.length} connections`);
        break;
      case "UNDO": {
        const depth = prevState._undoStack.length;
        if (depth > 0) {
          const snapshot = prevState._undoStack[depth - 1];
          const addedBack = snapshot.nodes.length - prevState.nodes.length;
          const connsBack = snapshot.connections.length - prevState.connections.length;
          const parts: string[] = [];
          if (addedBack > 0) parts.push(`+${addedBack} node${addedBack > 1 ? "s" : ""}`);
          if (addedBack < 0) parts.push(`${addedBack} node${addedBack < -1 ? "s" : ""}`);
          if (connsBack > 0) parts.push(`+${connsBack} conn`);
          if (connsBack < 0) parts.push(`${connsBack} conn`);
          log("output", `Undo — restored: ${parts.length > 0 ? parts.join(", ") : "state"} — stack depth: ${depth - 1}`);
        } else {
          log("output", `Undo — nothing to undo`);
        }
        break;
      }
      case "SELECT_NODE":
        if (action.payload.nodeId) {
          log("output", `Selected: ${nodeName(action.payload.nodeId)}`);
        } else if (prevState.selectedNodeId) {
          log("output", `Deselected: ${nodeName(prevState.selectedNodeId)}`);
        }
        break;
      case "CANCEL_CONNECTING":
        log("output", `Connection cancelled`);
        break;
    }
  }, [log, nodeName, state]);

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      // Strip outputData to avoid localStorage quota — it's regenerated on run
      const lightNodes = state.nodes.map(({ outputData, ...rest }) => rest);
      const data = JSON.stringify({ nodes: lightNodes, connections: state.connections });
      localStorage.setItem(storageKey, data);
      // Log save size occasionally (every 10th save to avoid spam)
      const bytes = new Blob([data]).size;
      if (bytes > 50000) {
        log("output", `State saved — ${(bytes / 1024).toFixed(1)} KB`);
      }
    } catch (err) {
      log("error", `localStorage save failed: ${err instanceof Error ? err.message : "quota exceeded"}`);
    }
  }, [state.nodes, state.connections, storageKey, log]);

  // Keyboard: Delete selected node, Ctrl+Z undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && state.selectedNodeId) {
        if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "TEXTAREA") return;
        e.preventDefault();
        log("output", `Delete key — removing selected node`);
        loggedDispatch({ type: "REMOVE_NODE", payload: { nodeId: state.selectedNodeId } });
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        log("output", `Ctrl+Z — undo`);
        loggedDispatch({ type: "UNDO" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.selectedNodeId, log, loggedDispatch]);

  const getFileData = projectType === "team" ? getTeamFileData : getLocalFileData;
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragStartPosition = useRef<{ x: number; y: number } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showTraces, setShowTraces] = useState(true);
  const [runsTableConfig, setRunsTableConfig] = useState<{ sweepConfig: any; batchDefType: string; batchTag: string; parentFileName: string; batchNodeId: string; baseParams: Record<string, string> } | null>(null);

  // Fixed canvas — nodes are constrained within bounds
  const canvasElRef = useRef<HTMLDivElement>(null);

  /* ── Drag handlers ── */
  const handleDragStart = useCallback((nodeId: string) => {
    setDraggingNodeId(nodeId);
    const node = state.nodes.find((n) => n.id === nodeId);
    if (node) dragStartPosition.current = { ...node.position };
  }, [state.nodes]);

  const handleDrag = useCallback((nodeId: string, { offset }: PanInfo) => {
    if (draggingNodeId !== nodeId || !dragStartPosition.current) return;
    const el = canvasElRef.current;
    const node = state.nodes.find((n) => n.id === nodeId);
    const nodeW = node ? getNodeWidth(node.defType) : 100;

    const maxX = el ? el.clientWidth - nodeW : 9999;
    const maxY = el ? el.clientHeight - NODE_HEIGHT : 9999;

    const newX = Math.max(0, Math.min(maxX, dragStartPosition.current.x + offset.x));
    const newY = Math.max(0, Math.min(maxY, dragStartPosition.current.y + offset.y));
    flushSync(() => {
      dispatch({ type: "MOVE_NODE", payload: { nodeId, position: { x: newX, y: newY } } });
    });
  }, [draggingNodeId, state.nodes]);

  const handleDragEnd = useCallback(() => {
    if (draggingNodeId) {
      const n = state.nodes.find((nd) => nd.id === draggingNodeId);
      if (n && dragStartPosition.current) {
        const dx = Math.round(n.position.x - dragStartPosition.current.x);
        const dy = Math.round(n.position.y - dragStartPosition.current.y);
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          log("output", `Node moved: ${nodeName(draggingNodeId)} → (${Math.round(n.position.x)}, ${Math.round(n.position.y)})`);
        }
      }
    }
    setDraggingNodeId(null);
    dragStartPosition.current = null;
  }, [draggingNodeId, state.nodes, log, nodeName]);

  /* ── Add node ── */
  const handleAddNode = useCallback((defType: string) => {
    const el = canvasElRef.current;
    const maxW = el ? el.clientWidth - getNodeWidth(defType) : 600;
    const maxH = el ? el.clientHeight - NODE_HEIGHT : 300;

    const lastNode = state.nodes[state.nodes.length - 1];
    let position = lastNode
      ? { x: lastNode.position.x + 150, y: lastNode.position.y }
      : { x: 50, y: 80 };

    // Wrap to next row if off-screen
    if (position.x > maxW) {
      position = { x: 50, y: Math.min(position.y + 60, maxH) };
    }
    position = { x: Math.min(position.x, maxW), y: Math.min(position.y, maxH) };

    loggedDispatch({ type: "ADD_NODE", payload: { defType, position } });
  }, [state.nodes, loggedDispatch]);

  /* ── Expose addFileNode / addBatchNode / getLoadedFileIds to parent via ref ── */
  useImperativeHandle(ref, () => ({
    getLoadedFileIds() {
      return state.nodes
        .filter((n) => n.config.fileId)
        .map((n) => String(n.config.fileId));
    },
    addBatchNode(defType: string, fileIds: string[], label: string, batchInfo?: Record<string, any>) {
      const lastNode = state.nodes[state.nodes.length - 1];
      const position = lastNode
        ? { x: lastNode.position.x + 150, y: lastNode.position.y }
        : { x: 50, y: 80 };
      const nodeId = `node-${Date.now()}`;
      dispatch({ type: "ADD_NODE", payload: { defType, position, id: nodeId } });
      log("output", `+ Node added: ${defType} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
      log("output", `Batch loaded: ${label}`);
      log("output", `  Type: ${defType} | Files: ${fileIds.length}`);
      setTimeout(() => {
        dispatch({
          type: "UPDATE_NODE_CONFIG",
          payload: { nodeId, config: { fileIds: fileIds.join(","), fileCount: fileIds.length, batchInfo: batchInfo ?? {} } },
        });
        dispatch({
          type: "SET_NODE_OUTPUT",
          payload: { nodeId, outputData: { batch: true, fileIds, label } },
        });
      }, 0);
    },
    addFileNode(file: ProjectFile, fileData: Record<string, any>) {
      // Map file type → node defType
      let defType = "hvac-file";
      if (file.category === "cable" && file.sub_type === "dc_bipole") defType = "dc-bipole-file";
      if (file.category === "cable" && file.sub_type === "hvac") defType = "hvac-file";
      if (file.category === "wmm") defType = "wmm-file";

      const lastNode = state.nodes[state.nodes.length - 1];
      const position = lastNode
        ? { x: lastNode.position.x + 150, y: lastNode.position.y }
        : { x: 50, y: 80 };

      const nodeId = `node-${Date.now()}`;
      dispatch({
        type: "ADD_NODE",
        payload: { defType, position, id: nodeId },
      });
      log("output", `+ Node added: ${defType} at (${Math.round(position.x)}, ${Math.round(position.y)})`);
      log("output", `File loaded: ${file.name}`);
      log("output", `  Type: ${defType} | Category: ${file.category} | Sub: ${file.sub_type ?? "—"}`);
      const fieldCount = Object.keys(fileData).length;
      log("output", `  Data: ${fieldCount} fields${fileData.magnetic ? " | Magnetic: yes" : ""}${fileData.mode ? ` | Mode: ${fileData.mode}` : ""}`);

      // Immediately set the file data as output
      setTimeout(() => {
        dispatch({
          type: "UPDATE_NODE_CONFIG",
          payload: { nodeId, config: { fileId: file.id, magnetic: fileData.magnetic ? 1 : 0, wmmMode: file.sub_type === "line" || file.sub_type === "grid" ? file.sub_type : (fileData.mode ?? "") } },
        });
        dispatch({
          type: "SET_NODE_OUTPUT",
          payload: {
            nodeId,
            outputData: {
              params: {
                ...fileData,
                cable_type: file.sub_type,
                file_name: file.name,
              },
            },
          },
        });
      }, 0);
    },
    logMessage(level: "output" | "error", message: string) {
      log(level, message);
    },
  }), [state.nodes, log]);

  /* ── Port connection ── */
  const handlePortDragStart = useCallback((nodeId: string, portId: string) => {
    loggedDispatch({ type: "START_CONNECTING", payload: { nodeId, portId } });
  }, []);

  const handlePortDragEnd = useCallback((nodeId: string, portId: string) => {
    if (state.connectingFromPort) {
      loggedDispatch({ type: "FINISH_CONNECTING", payload: { nodeId, portId } });
    }
  }, [state.connectingFromPort]);

  /* ── Run workflow ── */
  const handleRun = useCallback(async () => {
    if (state.nodes.length === 0) return;
    setIsExecuting(true);
    const runStart = performance.now();
    log("output", `------------------------------`);
    log("output", `RUN STARTED`);
    log("output", `  Nodes: ${state.nodes.length} | Connections: ${state.connections.length}`);

    // Log node types in execution order
    const nodeTypes = state.nodes.map((n) => {
      const d = getNodeDef(n.defType);
      return d?.title ?? n.defType;
    });
    log("output", `  Pipeline: ${nodeTypes.join(" → ")}`);

    // Reset all node statuses
    for (const node of state.nodes) {
      dispatch({ type: "SET_NODE_STATUS", payload: { nodeId: node.id, status: "idle" } });
    }

    // Track succeeded/failed via a counting wrapper
    let succeeded = 0;
    let failed = 0;
    const countingDispatch = (action: CanvasAction) => {
      loggedDispatch(action);
      if (action.type === "SET_NODE_STATUS") {
        if (action.payload.status === "done") succeeded++;
        if (action.payload.status === "error") failed++;
      }
    };

    try {
      await executeGraph(
        { nodes: state.nodes, connections: state.connections },
        countingDispatch
      );
      const elapsed = ((performance.now() - runStart) / 1000).toFixed(2);
      const total = state.nodes.length;
      log("output", `RUN COMPLETED — ${total} nodes in ${elapsed}s (${succeeded} succeeded, ${failed} failed)`);

    } catch (err) {
      const elapsed = ((performance.now() - runStart) / 1000).toFixed(2);
      const msg = err instanceof Error ? err.message : String(err);
      log("error", `RUN FAILED after ${elapsed}s: ${msg}`);
      console.error("Workflow execution error:", err);
    } finally {
      setIsExecuting(false);
      log("output", `------------------------------`);
    }
  }, [state.nodes, state.connections]);

  /* ── Canvas click deselect ── */
  const handleCanvasClick = useCallback(() => {
    loggedDispatch({ type: "SELECT_NODE", payload: { nodeId: null } });
    if (state.connectingFromPort) {
      loggedDispatch({ type: "CANCEL_CONNECTING" });
    }
  }, [state.connectingFromPort, loggedDispatch]);

  /* ── Selected node for config panel ── */
  const selectedNode = state.selectedNodeId
    ? state.nodes.find((n) => n.id === state.selectedNodeId) ?? null
    : null;
  const selectedDef = selectedNode ? getNodeDef(selectedNode.defType) : null;

  return (
    <div className="flex h-full w-full">
      {/* ── Left 2/3: workflow canvas ── */}
      <div className="relative flex w-2/3 flex-col">

        {/* ── Top 5/6: node canvas ── */}
        <div
          ref={(el) => { (canvasRef as React.MutableRefObject<HTMLDivElement | null>).current = el; (canvasElRef as React.MutableRefObject<HTMLDivElement | null>).current = el; }}
          className="relative overflow-hidden rounded-tl-lg border border-[#1a1a1a] bg-[#080808]"
          style={{ height: "83.33%" }}
          onClick={handleCanvasClick}
        >
          {/* Background */}
          <div className="pointer-events-none absolute inset-0 z-0">
            <FlickeringGrid
              color="rgb(255, 255, 255)"
              maxOpacity={0.08}
              flickerChance={0.15}
              squareSize={2}
              gridGap={8}
            />
          </div>

          {/* Pinned controls */}
          <div className="sticky left-0 top-0 z-20 flex items-center justify-between px-3 py-3 pointer-events-none">
            <div className="pointer-events-auto flex items-center gap-2">
              <WorkflowAddNodeMenu onAddNode={handleAddNode} />

              {/* Run button */}
              <button
                onClick={handleRun}
                disabled={isExecuting || state.nodes.length === 0}
                className="flex h-7 cursor-none items-center gap-1.5 rounded-md border border-[#222] bg-[#0d0d0d]/90 px-3 text-[10px] uppercase tracking-[0.2em] text-[#777] backdrop-blur-sm transition-colors hover:border-emerald-400/40 hover:text-emerald-400 disabled:opacity-30 disabled:pointer-events-none"
              >
                <Play className="h-3 w-3" />
                {isExecuting ? "Running" : "Run"}
              </button>

              {/* Traces toggle */}
              <button
                onClick={() => setShowTraces((v) => !v)}
                className="flex h-7 cursor-none items-center gap-2 rounded-md border border-[#222] bg-[#0d0d0d]/90 px-2.5 text-[10px] uppercase tracking-[0.2em] text-[#777] backdrop-blur-sm transition-colors"
              >
                <span className="text-[9px]">Traces</span>
                <div className={`relative h-3.5 w-7 rounded-full transition-colors duration-200 ${showTraces ? "bg-emerald-500/30" : "bg-[#222]"}`}>
                  <motion.div
                    className={`absolute top-0.5 h-2.5 w-2.5 rounded-full transition-colors duration-200 ${showTraces ? "bg-emerald-400" : "bg-[#555]"}`}
                    animate={{ x: showTraces ? 14 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                </div>
              </button>
            </div>

            {/* Stats */}
            <div className="pointer-events-none flex items-center gap-3 text-[10px] text-[#555]">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="uppercase tracking-[0.15em]">
                  {state.nodes.length} {state.nodes.length === 1 ? "Node" : "Nodes"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
                <span className="uppercase tracking-[0.15em]">
                  {state.connections.length} {state.connections.length === 1 ? "Connection" : "Connections"}
                </span>
              </div>
            </div>
          </div>

          {/* Content area — fills canvas */}
          <div className="relative h-full w-full">
            {/* SVG connections */}
            <svg
              className="pointer-events-none absolute inset-0"
              width="100%"
              height="100%"
              style={{ overflow: "visible" }}
            >
              {state.connections.map((c) => {
                const fromNode = state.nodes.find((n) => n.id === c.fromNodeId);
                const toNode = state.nodes.find((n) => n.id === c.toNodeId);
                if (!fromNode || !toNode) return null;
                const anyRunning = fromNode.status === "running" || toNode.status === "running";
                return (
                  <PortConnectionLine
                    key={c.id}
                    fromNode={fromNode}
                    toNode={toNode}
                    isRunning={anyRunning}
                  />
                );
              })}

              {/* Faint trace-back lines from batch-run nodes to their source batch */}
              {showTraces && state.nodes
                .filter((n) => n.config?.fromBatchRun && n.config?.sourceBatchNodeId)
                .map((runNode) => {
                  const batchNode = state.nodes.find((n) => n.id === runNode.config.sourceBatchNodeId);
                  if (!batchNode) return null;
                  const batchDef = getNodeDef(batchNode.defType);
                  const colorMap: Record<string, string> = {
                    red: "#f87171", white: "#ffffff", yellow: "#facc15", purple: "#c084fc",
                    emerald: "#34d399", blue: "#60a5fa", cyan: "#22d3ee",
                    rose: "#fb7185", amber: "#fbbf24", lime: "#a3e635",
                    violet: "#a78bfa", sky: "#38bdf8", pink: "#f472b6",
                    teal: "#2dd4bf", indigo: "#818cf8", gray: "#9ca3af",
                  };
                  const strokeColor = colorMap[batchDef?.color ?? ""] ?? "#333";
                  const w = getNodeWidth(runNode.defType);
                  const bw = getNodeWidth(batchNode.defType);
                  const startX = batchNode.position.x + bw / 2;
                  const startY = batchNode.position.y + NODE_HEIGHT;
                  const endX = runNode.position.x + w / 2;
                  const endY = runNode.position.y;
                  const midY = startY + (endY - startY) * 0.5;
                  const path = `M${startX},${startY} C${startX},${midY} ${endX},${midY} ${endX},${endY}`;
                  return (
                    <path
                      key={`trace-${runNode.id}`}
                      d={path}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={1}
                      strokeDasharray="4,4"
                      opacity={0.3}
                    />
                  );
                })}
            </svg>

            {/* Nodes */}
            {state.nodes.map((node) => {
              const def = getNodeDef(node.defType);
              if (!def) return null;
              const isDragging = draggingNodeId === node.id;
              return (
                <motion.div
                  key={node.id}
                  drag
                  dragMomentum={false}
                  dragConstraints={{ left: 0, top: 0, right: 100000, bottom: 100000 }}
                  onDragStart={() => handleDragStart(node.id)}
                  onDrag={(_, info) => handleDrag(node.id, info)}
                  onDragEnd={handleDragEnd}
                  style={{
                    x: node.position.x,
                    y: node.position.y,
                    width: getNodeWidth(node.defType),
                    transformOrigin: "0 0",
                  }}
                  className="absolute cursor-grab"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ scale: 1.02 }}
                  whileDrag={{ scale: 1.05, zIndex: 50, cursor: "grabbing" }}
                >
                  <WorkflowNodeCard
                    node={node}
                    def={def}
                    isDragging={isDragging}
                    isSelected={state.selectedNodeId === node.id}
                    onClick={() => loggedDispatch({ type: "SELECT_NODE", payload: { nodeId: node.id } })}
                    onPortDragStart={(portId) => handlePortDragStart(node.id, portId)}
                    onPortDragEnd={(portId) => handlePortDragEnd(node.id, portId)}
                    onToggleMagnetic={(nodeId) => {
                      const n = state.nodes.find((nd) => nd.id === nodeId);
                      if (!n) return;
                      const newMagnetic = !n.config.magnetic;
                      loggedDispatch({
                        type: "UPDATE_NODE_CONFIG",
                        payload: { nodeId, config: { ...n.config, magnetic: newMagnetic ? 1 : 0 } },
                      });
                      log("output", `Mode changed: ${newMagnetic ? "Magnetic" : "Non-magnetic"}`);
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* ── Bottom 1/6: info panel ── */}
        <div
          className="relative overflow-auto rounded-bl-lg border border-t-0 border-[#1a1a1a] bg-[#080808]"
          style={{ height: "16.67%" }}
        >
          <div className="pointer-events-none absolute inset-0 z-0">
            <FlickeringGrid
              color="rgb(255, 255, 255)"
              maxOpacity={0.04}
              flickerChance={0.08}
              squareSize={2}
              gridGap={8}
            />
          </div>
          <div className="relative z-10 flex h-full">
            {/* Left 2/3 — stdout/stderr console */}
            <div className="w-2/3 border-r border-[#1a1a1a]">
              <WorkflowConsolePanel logs={consoleLogs} />
            </div>
            {/* Right 1/3 — file details */}
            <div className="w-1/3">
              <WorkflowDetailsPanel
                nodes={state.nodes}
                selectedNodeId={state.selectedNodeId}
                files={files}
                getFileData={getFileData}
                projectId={projectId}
                onShowRunsTable={(config, batchDefType, batchTag, parentFileName, baseParams) => setRunsTableConfig({ sweepConfig: config, batchDefType, batchTag, parentFileName, batchNodeId: state.selectedNodeId ?? "", baseParams })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="w-px bg-[#1a1a1a]" />

      {/* ── Right 1/3: plot panel ── */}
      <div className="w-1/3">
        <WorkflowPlotPanel
          nodes={state.nodes}
          selectedNodeId={state.selectedNodeId}
        />
      </div>

      {/* Runs table modal */}
      <WorkflowRunsTableModal
        open={!!runsTableConfig}
        onClose={() => setRunsTableConfig(null)}
        sweepConfig={runsTableConfig?.sweepConfig ?? null}
        onLoadRun={(runIndex, paramValues) => {
          // Map batch type → single file type
          const batchType = runsTableConfig?.batchDefType ?? "";
          let defType = "hvac-file";
          if (batchType.includes("dc")) defType = "dc-bipole-file";
          if (batchType.includes("wmm")) defType = "wmm-file";

          const lastNode = state.nodes[state.nodes.length - 1];
          const position = lastNode
            ? { x: lastNode.position.x + 150, y: lastNode.position.y }
            : { x: 50, y: 80 };

          const nodeId = `node-${Date.now()}`;
          loggedDispatch({ type: "ADD_NODE", payload: { defType, position, id: nodeId } });

          // Merge base params (fixed) with swept param values (overrides)
          const baseParams = runsTableConfig?.baseParams ?? {};
          const mergedParams: Record<string, string | number> = {};
          for (const [k, v] of Object.entries(baseParams)) {
            const num = Number(v);
            mergedParams[k] = isNaN(num) ? v : num;
          }
          for (const [k, v] of Object.entries(paramValues)) {
            mergedParams[k] = v; // swept values override base
          }

          const paramLabel = Object.entries(paramValues)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ");
          const batchTag = runsTableConfig?.batchTag ?? "";
          const parentName = runsTableConfig?.parentFileName ?? "";
          setTimeout(() => {
            dispatch({
              type: "UPDATE_NODE_CONFIG",
              payload: { nodeId, config: {
                fromBatchRun: true,
                runIndex,
                params: mergedParams,
                batchTag,
                parentFileName: parentName,
                sourceBatchNodeId: runsTableConfig?.batchNodeId ?? "",
                fileName: `RUN ${runIndex + 1}${batchTag ? ` (@${batchTag})` : ""}${parentName ? ` - (@${parentName})` : ""}`,
              } },
            });
          }, 0);

          log("output", `+ Loaded run ${runIndex + 1} as ${defType} node (${paramLabel})`);
        }}
      />
    </div>
  );
});
