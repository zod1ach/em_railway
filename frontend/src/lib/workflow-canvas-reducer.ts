/**
 * Workflow canvas state management — immutable reducer.
 * Manages nodes, connections, and selection state.
 */

import type {
  WorkflowNodeInstance,
  WorkflowConnection,
  WorkflowGraph,
  NodeStatus,
} from "@/types/workflow-nodes";
import { canConnect } from "@/types/workflow-nodes";
import { getNodeDef } from "./workflow-node-registry";

/* ── State ── */

export interface CanvasState extends WorkflowGraph {
  readonly selectedNodeId: string | null;
  readonly connectingFromPort: { nodeId: string; portId: string } | null;
  readonly _undoStack: readonly CanvasSnapshot[];
}

interface CanvasSnapshot {
  readonly nodes: readonly WorkflowNodeInstance[];
  readonly connections: readonly WorkflowConnection[];
  readonly selectedNodeId: string | null;
}

const MAX_UNDO = 50;

export function createInitialCanvasState(): CanvasState {
  return {
    nodes: [],
    connections: [],
    selectedNodeId: null,
    connectingFromPort: null,
    _undoStack: [],
  };
}

/* ── Actions ── */

export type CanvasAction =
  | { type: "ADD_NODE"; payload: { defType: string; position: { x: number; y: number }; id?: string } }
  | { type: "REMOVE_NODE"; payload: { nodeId: string } }
  | { type: "MOVE_NODE"; payload: { nodeId: string; position: { x: number; y: number } } }
  | { type: "SELECT_NODE"; payload: { nodeId: string | null } }
  | { type: "START_CONNECTING"; payload: { nodeId: string; portId: string } }
  | { type: "FINISH_CONNECTING"; payload: { nodeId: string; portId: string } }
  | { type: "CANCEL_CONNECTING" }
  | { type: "REMOVE_CONNECTION"; payload: { connectionId: string } }
  | { type: "UPDATE_NODE_CONFIG"; payload: { nodeId: string; config: Record<string, unknown> } }
  | { type: "SET_NODE_STATUS"; payload: { nodeId: string; status: NodeStatus; errorMessage?: string } }
  | { type: "SET_NODE_OUTPUT"; payload: { nodeId: string; outputData: Record<string, unknown>; markDone?: boolean } }
  | { type: "CLEAR_ALL" }
  | { type: "LOAD_GRAPH"; payload: WorkflowGraph }
  | { type: "UNDO" };

/* ── Helpers ── */

let nodeCounter = 0;
function nextNodeId(): string {
  nodeCounter += 1;
  return `node-${Date.now()}-${nodeCounter}`;
}

function nextConnectionId(): string {
  return `conn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/* ── Undo snapshot helper ── */

function pushUndo(state: CanvasState): readonly CanvasSnapshot[] {
  const snapshot: CanvasSnapshot = {
    nodes: state.nodes,
    connections: state.connections,
    selectedNodeId: state.selectedNodeId,
  };
  const stack = [...state._undoStack, snapshot];
  return stack.length > MAX_UNDO ? stack.slice(-MAX_UNDO) : stack;
}

/* ── Reducer ── */

export function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "UNDO": {
      if (state._undoStack.length === 0) return state;
      const prev = state._undoStack[state._undoStack.length - 1];
      return {
        ...state,
        nodes: prev.nodes,
        connections: prev.connections,
        selectedNodeId: prev.selectedNodeId,
        connectingFromPort: null,
        _undoStack: state._undoStack.slice(0, -1),
      };
    }
    case "ADD_NODE": {
      const { defType, position, id } = action.payload;
      const def = getNodeDef(defType);
      if (!def) return state;
      const newNode: WorkflowNodeInstance = {
        id: id ?? nextNodeId(),
        defType,
        position,
        config: {},
        status: "idle",
      };
      return { ...state, nodes: [...state.nodes, newNode], _undoStack: pushUndo(state) };
    }

    case "REMOVE_NODE": {
      const { nodeId } = action.payload;
      return {
        ...state,
        nodes: state.nodes.filter((n) => n.id !== nodeId),
        connections: state.connections.filter(
          (c) => c.fromNodeId !== nodeId && c.toNodeId !== nodeId
        ),
        selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId,
        _undoStack: pushUndo(state),
      };
    }

    case "MOVE_NODE": {
      const { nodeId, position } = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, position } : n
        ),
      };
    }

    case "SELECT_NODE":
      return { ...state, selectedNodeId: action.payload.nodeId };

    case "START_CONNECTING":
      return { ...state, connectingFromPort: action.payload };

    case "CANCEL_CONNECTING":
      return { ...state, connectingFromPort: null };

    case "FINISH_CONNECTING": {
      const from = state.connectingFromPort;
      if (!from) return state;
      const { nodeId: toNodeId, portId: toPortId } = action.payload;

      // No self-connections
      if (from.nodeId === toNodeId) return { ...state, connectingFromPort: null };

      // No duplicate connections
      const exists = state.connections.some(
        (c) =>
          c.fromNodeId === from.nodeId &&
          c.fromPortId === from.portId &&
          c.toNodeId === toNodeId &&
          c.toPortId === toPortId
      );
      if (exists) return { ...state, connectingFromPort: null };

      // Validate port types
      const fromNode = state.nodes.find((n) => n.id === from.nodeId);
      const toNode = state.nodes.find((n) => n.id === toNodeId);
      if (!fromNode || !toNode) return { ...state, connectingFromPort: null };

      const fromDef = getNodeDef(fromNode.defType);
      const toDef = getNodeDef(toNode.defType);
      if (!fromDef || !toDef) return { ...state, connectingFromPort: null };

      const fromPort = fromDef.ports.find((p) => p.id === from.portId);
      const toPort = toDef.ports.find((p) => p.id === toPortId);
      if (!fromPort || !toPort || !canConnect(fromPort, toPort)) {
        return { ...state, connectingFromPort: null };
      }

      const newConn: WorkflowConnection = {
        id: nextConnectionId(),
        fromNodeId: from.nodeId,
        fromPortId: from.portId,
        toNodeId,
        toPortId,
      };
      return {
        ...state,
        connections: [...state.connections, newConn],
        connectingFromPort: null,
        _undoStack: pushUndo(state),
      };
    }

    case "REMOVE_CONNECTION":
      return {
        ...state,
        connections: state.connections.filter((c) => c.id !== action.payload.connectionId),
        _undoStack: pushUndo(state),
      };

    case "UPDATE_NODE_CONFIG": {
      const { nodeId, config } = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, config: { ...n.config, ...config } } : n
        ),
      };
    }

    case "SET_NODE_STATUS": {
      const { nodeId, status, errorMessage } = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === nodeId ? { ...n, status, errorMessage } : n
        ),
      };
    }

    case "SET_NODE_OUTPUT": {
      const { nodeId, outputData, markDone } = action.payload;
      return {
        ...state,
        nodes: state.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, outputData, ...(markDone ? { status: "done" as const } : {}) }
            : n
        ),
      };
    }

    case "CLEAR_ALL":
      return createInitialCanvasState();

    case "LOAD_GRAPH":
      return {
        ...state,
        nodes: action.payload.nodes,
        connections: action.payload.connections,
        selectedNodeId: null,
        connectingFromPort: null,
      };

    default:
      return state;
  }
}
