# Implementation Plan: ElectroFish Workflow Canvas — Domain-Specific Node System

## Selected Approach

**Evolve the existing custom canvas** (workflow-canvas.tsx) with domain-specific typed nodes, a client-side execution engine, and a right-panel plot renderer. No new library installs — the current motion.div + SVG connections system works well and avoids React Flow's 10K+ bundle.

### Architecture: Client-Side DAG Execution
- Nodes define typed input/output **ports** (Grid2D, Series1D, Scalar, GeoData)
- Connections validated by port type compatibility
- Execution follows **topological sort** — upstream nodes run first
- Compute nodes call existing backend `/calculate` endpoints
- Transform nodes run entirely client-side (JS math on arrays)
- Visualize nodes render D3 plots in the right 1/3 panel

---

## V1 Scope: 15 Node Types

### Source (4)
| Node | Color | Ports Out | Description |
|------|-------|-----------|-------------|
| HVAC File | rose | `params: CableParams` | Links to an HVAC file in the tree |
| DC Bipole File | yellow | `params: CableParams` | Links to a DC Bipole file |
| WMM File | purple | `params: WMMParams` | Links to a WMM file |
| Batch Folder | lime | `results: BatchResults` | Links to existing batch results |

### Compute (3)
| Node | Color | Ports In → Out | Backend Endpoint |
|------|-------|----------------|-----------------|
| Single Run | emerald | `params → plots: PlotBundle` | `/calculate/hvac-*`, `/calculate/dc-bipole` |
| Batch Sweep | blue | `params → results: BatchResults` | `/batches` (existing) |
| Location Transect | cyan | `params + geo → results: BatchResults` | `/batches` (location mode) |

### Transform (3)
| Node | Color | Ports In → Out | Client-Side |
|------|-------|----------------|-------------|
| Slice | amber | `Grid2D → Series1D` | Extract row/col/diagonal from heatmap |
| Threshold | red | `Grid2D → Grid2D` | Mask values above/below limit |
| Merge | indigo | `Series1D[] → MultiSeries` | Combine line plots |

### Visualize (4)
| Node | Color | Ports In | Renders |
|------|-------|----------|---------|
| Heatmap | violet | `Grid2D` | Existing D3 heatmap in right panel |
| Line Chart | sky | `Series1D / MultiSeries` | Existing D3 line plot |
| Polar Chart | pink | `PolarData` | Existing D3 polar plot |
| Geographic Map | teal | `GeoData` | Leaflet map (already exists) |

### Output (1)
| Node | Color | Ports In | Action |
|------|-------|----------|--------|
| Export | gray | `any` | Download PNG/CSV/PDF |

---

## Implementation Steps

### Phase 1: Type System & Node Registry (New Files)

**Step 1.1** — Create `frontend/src/types/workflow-nodes.ts`
- Define `PortType` enum: `CableParams | WMMParams | Grid2D | Series1D | PolarData | GeoData | MultiSeries | BatchResults | PlotBundle | Scalar`
- Define `PortDef` interface: `{ id, name, type: PortType, direction: "in" | "out" }`
- Define `NodeCategory` type: `"source" | "compute" | "transform" | "visualize" | "output"`
- Define `WorkflowNodeDef` interface (static definition): `{ type, category, title, description, icon, color, ports: PortDef[], configSchema? }`
- Define `WorkflowNodeInstance` interface (runtime): `{ id, defType, position, config, status: "idle" | "running" | "done" | "error", outputData? }`
- Define `WorkflowConnection` interface: `{ id, fromNodeId, fromPortId, toNodeId, toPortId }`
- Define `WorkflowGraph` interface: `{ nodes: WorkflowNodeInstance[], connections: WorkflowConnection[] }`
- Define port type compatibility matrix function

**Step 1.2** — Create `frontend/src/lib/workflow-node-registry.ts`
- Export `NODE_REGISTRY: Record<string, WorkflowNodeDef>` with all 15 v1 node definitions
- Each entry specifies icon (lucide), color, port definitions, and optional config schema
- Export `getNodeDef(type: string): WorkflowNodeDef`
- Export `canConnect(fromPort: PortDef, toPort: PortDef): boolean`
- Export `NODE_PALETTE` — grouped by category for the add-node UI

### Phase 2: Canvas State Management (New File)

**Step 2.1** — Create `frontend/src/lib/workflow-canvas-reducer.ts`
- Actions: `ADD_NODE | REMOVE_NODE | MOVE_NODE | ADD_CONNECTION | REMOVE_CONNECTION | UPDATE_NODE_CONFIG | SET_NODE_STATUS | SET_NODE_OUTPUT | CLEAR_ALL`
- Immutable state updates (new objects, never mutate)
- Connection validation on ADD_CONNECTION (port type check)
- Auto-layout helper for initial node placement

### Phase 3: Execution Engine (New File)

**Step 3.1** — Create `frontend/src/lib/workflow-executor.ts`
- `topologicalSort(graph: WorkflowGraph): string[]` — Kahn's algorithm
- `executeGraph(graph, dispatch)` — async, walks sorted nodes:
  - Source nodes: resolve file data from project store
  - Compute nodes: call backend API, await response
  - Transform nodes: run client-side JS (slice, threshold, merge)
  - Visualize nodes: set output data for rendering
  - Output nodes: trigger download
- Error propagation: if a node fails, downstream nodes get `error` status
- Dispatch status updates (`SET_NODE_STATUS`) as each node runs

### Phase 4: UI Components (Modify + New Files)

**Step 4.1** — Refactor `frontend/src/components/ui/workflow-canvas.tsx`
- Replace generic `WorkflowNode` interface with `WorkflowNodeInstance`
- Replace `nodeTemplates` with import from `NODE_REGISTRY`
- Replace `addNode()` with `addNodeOfType(type: string)` dispatching to reducer
- Node card rendering: show ports (small dots on left/right edges)
- Port-to-port connection drawing (drag from output port to input port)
- Selected node highlighting

**Step 4.2** — Create `frontend/src/components/ui/workflow-node-card.tsx` (~150 lines)
- Extracted from workflow-canvas.tsx for clean separation
- Props: `node: WorkflowNodeInstance, def: WorkflowNodeDef, isDragging, isSelected, onPortDragStart, onPortDragEnd`
- Renders: icon, title, category badge, status indicator, input/output port dots
- Port dots: small circles on left edge (inputs) and right edge (outputs), colored by PortType
- Click: selects node (opens config in form panel)

**Step 4.3** — Create `frontend/src/components/ui/workflow-add-node-menu.tsx` (~120 lines)
- Triggered by the existing "+ Node" button
- Dropdown/popover grouped by category (Source, Compute, Transform, Visualize, Output)
- Each item shows icon + title + port summary
- Clicking adds node at a sensible position on canvas

**Step 4.4** — Create `frontend/src/components/ui/workflow-plot-panel.tsx` (~100 lines)
- Renders in the right 1/3 panel (replaces the "Plots" placeholder)
- When a visualize node is selected AND has output data, renders D3Plot
- Supports switching between multiple visualize nodes' outputs
- Tabs or stacked layout for multiple active plots

**Step 4.5** — Update `frontend/src/components/ui/workflow-canvas.tsx`
- Add "Run" button (play icon) next to "+ Node" — triggers `executeGraph()`
- Show execution progress: nodes pulse/glow as they run
- Connection lines animate during execution (dashes flow in direction)

### Phase 5: Integration with Project Workspace

**Step 5.1** — Update `frontend/src/components/ui/project-workspace.tsx`
- Pass `projectId`, `files`, and `fileData` to WorkflowCanvas
- When a source node is added, show file picker to link it to a project file
- When a node is clicked, open its config form in the existing form panel (above canvas)
- Canvas state persists in component state (v1); save to localStorage (v2)

### Phase 6: Node Config Forms

**Step 6.1** — Create `frontend/src/components/ui/workflow-node-config.tsx` (~200 lines)
- Dynamic form that renders based on `WorkflowNodeDef.configSchema`
- Source nodes: file selector dropdown (filtered by category)
- Compute nodes: endpoint params (reuse shared-param-defs)
- Transform nodes: slice position/angle, threshold value, merge options
- Visualize nodes: colormap, axis labels, scale options
- Output nodes: format selector (PNG/CSV/PDF)

---

## Key Files

| File | Operation | Description |
|------|-----------|-------------|
| `frontend/src/types/workflow-nodes.ts` | **Create** | Port types, node definitions, graph interfaces |
| `frontend/src/lib/workflow-node-registry.ts` | **Create** | 15 node type definitions with ports |
| `frontend/src/lib/workflow-canvas-reducer.ts` | **Create** | Immutable state management |
| `frontend/src/lib/workflow-executor.ts` | **Create** | DAG topological sort + async execution |
| `frontend/src/components/ui/workflow-canvas.tsx` | **Modify** | Swap generic nodes for typed system |
| `frontend/src/components/ui/workflow-node-card.tsx` | **Create** | Individual node rendering with ports |
| `frontend/src/components/ui/workflow-add-node-menu.tsx` | **Create** | Categorized node picker |
| `frontend/src/components/ui/workflow-plot-panel.tsx` | **Create** | Right panel plot renderer |
| `frontend/src/components/ui/workflow-node-config.tsx` | **Create** | Dynamic node config forms |
| `frontend/src/components/ui/project-workspace.tsx` | **Modify** | Wire canvas to project data |

## Dependencies

No new npm packages needed for v1:
- motion (already installed) — drag, animations
- lucide-react (already installed) — node icons
- D3 (already installed) — plot rendering
- FlickeringGrid (already installed) — canvas background

## Risks and Mitigation

| Risk | Mitigation |
|------|------------|
| Port-to-port drag UX complexity | Start with click-to-connect (click output port, then click input port) rather than drag |
| Performance with many D3 plots | Only render selected visualize node's plot; lazy-mount others |
| Backend calls failing mid-execution | Error propagation marks downstream nodes as error; retry button per node |
| Canvas state loss on navigation | Save to localStorage keyed by projectId; restore on mount |
| Large data transfers for heatmaps | Backend already downsamples to 500x500; keep that |

## Test Strategy

| Test Type | What | How |
|-----------|------|-----|
| Unit | Port type compatibility | Pure function test for `canConnect()` |
| Unit | Topological sort | Test DAG ordering, cycle detection |
| Unit | Reducer actions | Test each action produces correct immutable state |
| Integration | Node execution | Mock fetch, verify compute node calls correct endpoint |
| Integration | Transform nodes | Feed sample Grid2D, verify Slice/Threshold output |
| E2E | Full workflow | Add source → compute → visualize, run, verify plot appears |

## Estimated Complexity

**High** — 8 new files, ~1200 total new lines, modifies 2 existing files. But each phase is independently testable. Recommend implementing Phase 1-2 first, verify, then Phase 3-4.

## Execution Order for /deep-execute

1. Phase 1 (types + registry) — no deps, can parallelize both files
2. Phase 2 (reducer) — depends on types from Phase 1
3. Phase 3 (executor) — depends on types + registry
4. Phase 4 (UI components) — depends on all above; 4.1-4.5 are partially parallelizable
5. Phase 5 (workspace integration) — depends on Phase 4
6. Phase 6 (config forms) — depends on Phase 4
