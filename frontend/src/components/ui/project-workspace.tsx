import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Cable, Globe, File, Package, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { TreeView, type TreeNode } from "@/components/ui/tree-view";
import { CableTypePicker } from "@/components/ui/cable-type-picker";
import { HvacForm } from "@/components/ui/hvac-form";
import { DCBipoleForm } from "@/components/ui/dc-bipole-form";
import { HoldDeleteButton } from "@/components/ui/hold-delete-button";
import { WMMForm } from "@/components/ui/wmm-form";
import { WMMTypePicker } from "@/components/ui/wmm-type-picker";
import { BatchExplorer } from "@/components/batch/batch-explorer";
import { BatchWizard } from "@/components/batch/batch-wizard";
import { CanvasPlusButton } from "@/components/ui/canvas-plus-button";
import { WorkflowCanvas, type WorkflowCanvasHandle } from "@/components/ui/workflow-canvas";
import {
  getLocalFiles, createLocalFile, deleteLocalFile,
  getTeamFiles, createTeamFile, deleteTeamFile,
  getLocalFileData, saveLocalFileData,
  getTeamFileData, saveTeamFileData,
} from "@/lib/project-files";
import { getBatches, deleteBatch } from "@/lib/batch-files";
import type { ProjectFile, FileCategory, CableSubType, BatchFolder, TreeNodeData } from "@/types/project-files";
import { TEAM_FILE_LIMIT } from "@/types/project-files";

interface ProjectWorkspaceProps {
  projectId: string;
  projectName: string;
  projectType: "local" | "team";
  myRole?: "Owner" | "Editor" | "Viewer";
  onGoToProjects: () => void;
  onSelectFile: (fileId: string, fileName: string) => void;
  onOpenSettings?: () => void;
}

/* ── Batch folder load button — CableTypePicker style ── */
function BatchFolderLoadButton({
  folder,
  parentFile,
  projectId,
  canvasOpen,
  onOpenCanvas,
  canvasRef,
  getFileData,
  loadedFileIds,
}: {
  folder: BatchFolder;
  parentFile: ProjectFile | undefined;
  projectId: string;
  canvasOpen: boolean;
  onOpenCanvas: () => void;
  canvasRef: React.RefObject<WorkflowCanvasHandle | null>;
  getFileData: (projectId: string, fileId: string) => Promise<Record<string, any> | null>;
  loadedFileIds: Set<string>;
}) {
  const [open, setOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowConfirm(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open]);

  const loadFiles = async (mode: "batch" | "individual") => {
    if (!parentFile) return;
    if (!canvasOpen) onOpenCanvas();
    const delay = canvasOpen ? 0 : 300;

    if (mode === "batch") {
      // Map batch_mode + cable type → batch node type
      let batchDefType = "batch-hvac-nonmag";
      if (parentFile.sub_type === "hvac") {
        batchDefType = folder.batch_mode === "magnetic" ? "batch-hvac-mixed" : "batch-hvac-nonmag";
      } else if (parentFile.sub_type === "dc_bipole") {
        batchDefType = folder.batch_mode === "location" ? "batch-dc-location" : "batch-dc-cable";
      }
      setTimeout(() => {
        canvasRef.current?.addBatchNode(
          batchDefType,
          [folder.id],
          `${folder.name} (${folder.total_runs})`,
          {
            name: folder.name,
            batch_mode: folder.batch_mode,
            total_runs: folder.total_runs,
            sweep_config: folder.sweep_config,
            base_params: folder.base_params,
            batchTag: folder.tag,
            parentFileName: parentFile?.name ?? "",
          },
        );
      }, delay);
      setOpen(false);
      return;
    }

    // Individual mode — fetch runs
    const { getBatchRuns } = await import("@/lib/batch-files");
    const runs = await getBatchRuns(projectId, folder.id);

    if (runs.length > 10) {
      setShowConfirm(true);
      return;
    }

    for (const run of runs) {
      if (loadedFileIds.has(run.file_id)) continue;
      const file = {
        id: run.file_id,
        name: run.file_name ?? `Run ${run.file_id.slice(0, 6)}`,
        category: parentFile.category,
        sub_type: parentFile.sub_type,
      } as ProjectFile;
      let data: Record<string, any> = {};
      try { data = await getFileData(projectId, file.id) ?? {}; } catch { /* skip */ }
      setTimeout(() => canvasRef.current?.addFileNode(file, data), delay);
    }
    setOpen(false);
  };

  const confirmIndividualLoad = async () => {
    if (!parentFile) return;
    if (!canvasOpen) onOpenCanvas();
    const delay = canvasOpen ? 0 : 300;
    const { getBatchRuns } = await import("@/lib/batch-files");
    const runs = await getBatchRuns(projectId, folder.id);
    for (const run of runs) {
      if (loadedFileIds.has(run.file_id)) continue;
      const file = {
        id: run.file_id,
        name: run.file_name ?? `Run ${run.file_id.slice(0, 6)}`,
        category: parentFile.category,
        sub_type: parentFile.sub_type,
      } as ProjectFile;
      let data: Record<string, any> = {};
      try { data = await getFileData(projectId, file.id) ?? {}; } catch { /* skip */ }
      setTimeout(() => canvasRef.current?.addFileNode(file, data), delay);
    }
    setOpen(false);
    setShowConfirm(false);
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((p) => !p); setShowConfirm(false); }}
        className="p-0.5 text-[#444] hover:text-[#CCFF00] transition-colors cursor-none"
        title="Load batch to canvas"
      >
        <ArrowRight className="h-3 w-3" />
      </button>

      <AnimatePresence>
        {open && !showConfirm && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{
              opacity: 1,
              width: "auto",
              transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
            }}
            exit={{
              opacity: 0,
              width: 0,
              transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
            }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-1 overflow-hidden z-50"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <motion.button
                onClick={(e) => { e.stopPropagation(); loadFiles("batch"); }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                whileTap={{ scale: 0.96 }}
                className="text-xs text-white font-bold hover:text-[#CCFF00] transition-colors cursor-none"
              >
                BATCH
              </motion.button>
              <motion.button
                onClick={(e) => { e.stopPropagation(); loadFiles("individual"); }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }}
                whileTap={{ scale: 0.96 }}
                className="text-xs text-white font-bold hover:text-[#CCFF00] transition-colors cursor-none"
              >
                INDIVIDUAL
              </motion.button>
            </div>
          </motion.div>
        )}

        {open && showConfirm && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{
              opacity: 1,
              width: "auto",
              transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
            }}
            exit={{ opacity: 0, width: 0 }}
            className="absolute left-full top-1/2 -translate-y-1/2 ml-1 overflow-hidden z-50"
          >
            <div className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-[10px] text-red-400">10+ files.</span>
              <motion.button
                onClick={(e) => { e.stopPropagation(); confirmIndividualLoad(); }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.96 }}
                className="text-xs text-red-400 font-bold hover:text-red-300 transition-colors cursor-none"
              >
                YES
              </motion.button>
              <motion.button
                onClick={(e) => { e.stopPropagation(); setShowConfirm(false); setOpen(false); }}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                whileTap={{ scale: 0.96 }}
                className="text-xs text-white/50 font-bold hover:text-white transition-colors cursor-none"
              >
                NO
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Category folder config ── */
const FOLDERS: { id: FileCategory; label: string; icon: React.ReactNode }[] = [
  { id: "cable", label: "Cable Model", icon: <Cable className="h-4 w-4" /> },
  { id: "wmm", label: "WMM Model", icon: <Globe className="h-4 w-4" /> },
];

export function ProjectWorkspace({
  projectId,
  projectName,
  projectType,
  myRole,
  onGoToProjects,
  onSelectFile,
  onOpenSettings,
}: ProjectWorkspaceProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [batchFolders, setBatchFolders] = useState<BatchFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [treeOpen, setTreeOpen] = useState(true);
  const [canvasOpen, setCanvasOpen] = useState(false);
  const [cablePickerOpen, setCablePickerOpen] = useState(false);
  const [showHvacForm, setShowHvacForm] = useState(false);
  const [showDcForm, setShowDcForm] = useState(false);
  const [showWmmForm, setShowWmmForm] = useState(false);
  const [wmmPickerOpen, setWmmPickerOpen] = useState(false);
  const [wmmCreateMode, setWmmCreateMode] = useState<"grid" | "line">("grid");
  const [activeBatch, setActiveBatch] = useState<{ folder: BatchFolder; parentFile: ProjectFile } | null>(null);
  const [showBatchWizard, setShowBatchWizard] = useState<{ parentFile: ProjectFile; parentData: Record<string, any> } | null>(null);

  const isTeam = projectType === "team";
  const canEdit = !isTeam || myRole === "Owner" || myRole === "Editor";

  const canvasRef = useRef<WorkflowCanvasHandle>(null);
  const [loadedFileIds, setLoadedFileIds] = useState<Set<string>>(() => {
    // Pre-load from localStorage to show green arrows even before canvas mounts
    try {
      const saved = localStorage.getItem(`electrofish_canvas_${projectId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        const ids = (parsed.nodes ?? [])
          .filter((n: any) => n.config?.fileId)
          .map((n: any) => String(n.config.fileId));
        return new Set(ids);
      }
    } catch { /* ignore */ }
    return new Set();
  });

  /* ── Click outside to close forms ── */
  const formPanelRef = useRef<HTMLDivElement>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideForm = formPanelRef.current?.contains(target);
      const insideTree = treeRef.current?.contains(target);
      if (!insideForm && !insideTree) {
        closeAllForms();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── Load files + batch folders ── */
  const loadFiles = useCallback(async () => {
    try {
      const data = isTeam
        ? await getTeamFiles(projectId)
        : await getLocalFiles(projectId);
      setFiles(data);

      // Load batch folders (personal mode only for now)
      if (!isTeam) {
        try {
          const batches = await getBatches(projectId);
          setBatchFolders(batches);
        } catch {
          setBatchFolders([]);
        }
      }
    } catch (err) {
      console.error("Failed to load files:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId, isTeam]);

  useEffect(() => { loadFiles(); }, [loadFiles]);


  /* ── File icon color helper ── */
  const getFileIconColor = (f: ProjectFile): string => {
    if (f.category === "cable") {
      if (f.sub_type === "dc_bipole") return "#facc15"; // yellow-400
      return "#9f1239"; // rose-800 (maroon)
    }
    if (f.category === "wmm") {
      if (f.sub_type === "line") return "#facc15"; // yellow-400
      return "#c084fc"; // purple-400
    }
    return "#ffffff";
  };

  /* ── Build tree data (with batch folders under parent files) ── */
  const treeData: TreeNode[] = useMemo(() => {
    // Only show root files (not batch-generated ones)
    const rootFiles = files.filter((f) => !f.batch_folder_id);

    return FOLDERS.map((folder) => {
      const folderFiles = rootFiles.filter((f) => f.category === folder.id);
      const children: TreeNode[] = folderFiles.map((f) => {
        // Find batch folders that belong to this file
        const fileBatches = batchFolders.filter((bf) => bf.parent_file_id === f.id);

        const batchChildren: TreeNode[] = fileBatches.map((bf) => ({
          id: `batch-${bf.id}`,
          label: bf.name,
          icon: <Package className="h-4 w-4" style={{ color: "#CCFF00" }} />,
          data: { kind: "batch-folder" as const, folder: bf, parentFile: f } satisfies TreeNodeData,
        }));

        return {
          id: f.id,
          label: f.name,
          icon: <File className="h-4 w-4" style={{ color: getFileIconColor(f) }} />,
          data: { kind: "file" as const, file: f } satisfies TreeNodeData,
          // Only add children array if there are batch folders (otherwise node stays a leaf)
          ...(batchChildren.length > 0 ? { children: batchChildren } : {}),
        };
      });
      return {
        id: `folder-${folder.id}`,
        label: folder.label,
        icon: folder.icon,
        children,
      };
    });
  }, [files, batchFolders]);

  const [editingFile, setEditingFile] = useState<ProjectFile | null>(null);
  const [editingFileData, setEditingFileData] = useState<Record<string, any> | null>(null);

  const getFileData = isTeam ? getTeamFileData : getLocalFileData;
  const saveFileData = isTeam ? saveTeamFileData : saveLocalFileData;

  const closeAllForms = () => {
    setShowHvacForm(false);
    setShowDcForm(false);
    setShowWmmForm(false);
    setEditingFile(null);
    setEditingFileData(null);
    setActiveBatch(null);
    setShowBatchWizard(null);
  };

  const openFileForEdit = async (file: ProjectFile) => {
    let data: Record<string, any> = {};
    try {
      data = await getFileData(projectId, file.id) ?? {};
    } catch {
      data = {};
    }
    switchToForm({ editFile: file, editData: data });
  };

  // Set all form states at once to avoid intermediate renders
  const switchToForm = useCallback((options: {
    hvac?: boolean;
    dc?: boolean;
    wmm?: boolean;
    editFile?: ProjectFile | null;
    editData?: Record<string, any> | null;
    batch?: { folder: BatchFolder; parentFile: ProjectFile } | null;
    wizard?: { parentFile: ProjectFile; parentData: Record<string, any> } | null;
  }) => {
    setShowHvacForm(options.hvac ?? false);
    setShowDcForm(options.dc ?? false);
    setShowWmmForm(options.wmm ?? false);
    setEditingFile(options.editFile ?? null);
    setEditingFileData(options.editData ?? null);
    setActiveBatch(options.batch ?? null);
    setShowBatchWizard(options.wizard ?? null);
  }, []);

  const handleNodeClick = async (node: TreeNode) => {
    if (!node.data) return;

    const nodeData = node.data as TreeNodeData | ProjectFile;
    if ("kind" in nodeData) {
      if (nodeData.kind === "batch-folder") {
        switchToForm({ batch: { folder: nodeData.folder, parentFile: nodeData.parentFile } });
        return;
      }
      if (nodeData.kind === "file") {
        const file = nodeData.file;
        if (file.category === "cable" || file.category === "wmm") {
          await openFileForEdit(file);
        } else {
          onSelectFile(file.id, file.name);
        }
        return;
      }
    }

    const file = nodeData as ProjectFile;
    if (file.category === "cable" || file.category === "wmm") {
      await openFileForEdit(file);
    } else {
      onSelectFile(file.id, file.name);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0d] cursor-none">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0d0d0d]/80 backdrop-blur-md">
        <div className="w-full pr-12 h-16 flex items-center" style={{ paddingLeft: "51px" }}>
          <Breadcrumbs
            items={[
              { label: "Projects", onClick: onGoToProjects },
              { label: projectName },
            ]}
          />
        </div>
      </header>

      {/* Main content — tree on left, form on right */}
      <main className="flex-1 px-12" style={{ paddingTop: 0, paddingBottom: 24, marginTop: -8 }}>
        {/* Toolbar — hamburger + canvas button */}
        <div className="mb-3 flex items-center gap-3">
          {/* Hamburger toggle */}
          <button
            onClick={() => setTreeOpen((v) => !v)}
            className="cursor-none"
          >
            <svg viewBox="0 0 40 40" fill="none" style={{ width: 30, height: 30 }}>
              <motion.line
                x1="10" x2="30" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                animate={treeOpen ? { y1: 20, y2: 20, rotate: 45 } : { y1: 12, y2: 12, rotate: 0 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                style={{ transformOrigin: "20px 20px" }}
              />
              <motion.line
                x1="10" y1="20" x2="30" y2="20" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                animate={treeOpen ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
                transition={{ duration: 0.2 }}
                style={{ transformOrigin: "20px 20px" }}
              />
              <motion.line
                x1="10" x2="30" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
                animate={treeOpen ? { y1: 20, y2: 20, rotate: -45 } : { y1: 28, y2: 28, rotate: 0 }}
                transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
                style={{ transformOrigin: "20px 20px" }}
              />
            </svg>
          </button>

          {/* Canvas button — next to hamburger */}
          <CanvasPlusButton onClick={() => setCanvasOpen((v) => !v)} />
        </div>

        <div className="flex gap-12 items-start">
        {/* Tree view — left side */}
        <AnimatePresence>
          {treeOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: "auto", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              style={{ overflow: "visible" }}
              className="shrink-0"
            >
              {loading ? (
                <div className="w-fit space-y-2">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-10 bg-[#161616] rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="w-fit" ref={treeRef} data-tree-card>
                  <TreeView
                    data={treeData}
                    onNodeClick={handleNodeClick}
                    onAddClick={(node) => {
                      const folderId = node.id.replace("folder-", "");
                      if (folderId === "cable") {
                        setCablePickerOpen(true);
                      } else if (folderId === "wmm") {
                        setWmmPickerOpen(true);
                      }
                    }}
                    renderAfterAdd={(node) => {
                      if (node.id === "folder-cable") {
                        return (
                          <CableTypePicker
                            open={cablePickerOpen}
                            onClose={() => setCablePickerOpen(false)}
                            onSelect={(subType) => {
                              closeAllForms();
                              if (subType === "hvac") {
                                setShowHvacForm(true);
                              } else {
                                setShowDcForm(true);
                              }
                            }}
                          />
                        );
                      }
                      if (node.id === "folder-wmm") {
                        return (
                          <WMMTypePicker
                            open={wmmPickerOpen}
                            onClose={() => setWmmPickerOpen(false)}
                            onSelect={(mode) => {
                              closeAllForms();
                              setShowWmmForm(true);
                              // Store selected mode for the form — we'll pass it via state
                              setWmmCreateMode(mode);
                            }}
                          />
                        );
                      }
                      return null;
                    }}
                    renderAfterNode={(node) => {
                      if (!node.data) return null;
                      const nodeData = node.data as TreeNodeData | ProjectFile;
                      // Batch folder nodes get --> button + delete button
                      if ("kind" in nodeData && nodeData.kind === "batch-folder") {
                        return (
                          <div className="flex items-center gap-0.5">
                            <HoldDeleteButton
                              onDelete={async () => {
                                await deleteBatch(projectId, nodeData.folder.id);
                                setBatchFolders((prev) => prev.filter((bf) => bf.id !== nodeData.folder.id));
                                if (activeBatch?.folder.id === nodeData.folder.id) {
                                  setActiveBatch(null);
                                }
                              }}
                              holdDuration={3000}
                            />
                            <BatchFolderLoadButton
                              folder={nodeData.folder}
                              parentFile={files.find((f) => f.id === nodeData.folder.parent_file_id)}
                              projectId={projectId}
                              canvasOpen={canvasOpen}
                              onOpenCanvas={() => setCanvasOpen(true)}
                              canvasRef={canvasRef}
                              getFileData={getFileData}
                              loadedFileIds={loadedFileIds}
                            />
                          </div>
                        );
                      }
                      const file = ("kind" in nodeData && nodeData.kind === "file") ? nodeData.file : nodeData as ProjectFile;

                      return (
                        <div className="flex items-center gap-0.5">
                          {/* Load to canvas button — skips if already loaded */}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Check live canvas state, not stale Set
                              const liveIds = canvasRef.current?.getLoadedFileIds() ?? [];
                              if (liveIds.includes(file.id)) {
                                canvasRef.current?.logMessage("output", `Duplicate load prevented: ${file.name} already on canvas`);
                                return;
                              }
                              if (!canvasOpen) setCanvasOpen(true);
                              let data: Record<string, any> = {};
                              try {
                                data = await getFileData(projectId, file.id) ?? {};
                              } catch (err) {
                                const msg = err instanceof Error ? err.message : String(err);
                                setTimeout(() => canvasRef.current?.logMessage("error", `File data fetch failed: ${file.name} — ${msg}`), 300);
                              }
                              setTimeout(() => {
                                canvasRef.current?.addFileNode(file, data);
                                setLoadedFileIds((prev) => new Set([...prev, file.id]));
                              }, canvasOpen ? 0 : 300);
                            }}
                            className={`p-0.5 transition-colors cursor-none ${
                              loadedFileIds.has(file.id)
                                ? "text-emerald-500/50"
                                : "text-[#444] hover:text-[#CCFF00]"
                            }`}
                            title={loadedFileIds.has(file.id) ? "Already on canvas" : "Load to canvas"}
                            onMouseEnter={() => {
                              // Sync loaded IDs from canvas for accurate arrow color
                              const liveIds = canvasRef.current?.getLoadedFileIds() ?? [];
                              setLoadedFileIds(new Set(liveIds));
                            }}
                          >
                            <ArrowRight className="h-3 w-3" />
                          </button>
                          {/* Batch button — only for cable files in personal mode, owners in team */}
                          {(!isTeam || myRole === "Owner") && file.category === "cable" && !file.batch_folder_id && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                let data: Record<string, any> = {};
                                try {
                                  data = await getFileData(projectId, file.id) ?? {};
                                } catch { /* use empty */ }
                                switchToForm({ wizard: { parentFile: file, parentData: data } });
                              }}
                              className="p-0.5 text-[#444] hover:text-[#CCFF00] transition-colors cursor-none"
                              title="Create batch"
                            >
                              <Package className="h-3 w-3" />
                            </button>
                          )}
                          <HoldDeleteButton
                            onDelete={async () => {
                              if (isTeam) {
                                await deleteTeamFile(projectId, file.id);
                              } else {
                                await deleteLocalFile(projectId, file.id);
                              }
                              setFiles((prev) => prev.filter((f) => f.id !== file.id && f.batch_folder_id !== file.id));
                              setBatchFolders((prev) => prev.filter((bf) => bf.parent_file_id !== file.id));
                              if (editingFile?.id === file.id) {
                                setEditingFile(null);
                                setEditingFileData(null);
                              }
                              if (activeBatch?.parentFile.id === file.id) {
                                setActiveBatch(null);
                              }
                            }}
                            holdDuration={3000}
                          />
                        </div>
                      );
                    }}
                    renderLabel={(node, isFolder) => {
                      if (isFolder) return node.label;

                      // Handle batch folder nodes
                      const nodeData = node.data as TreeNodeData | ProjectFile | undefined;
                      if (nodeData && "kind" in nodeData && nodeData.kind === "batch-folder") {
                        return (
                          <span className={cn("text-[#CCFF00]", "bg-[#CCFF00]/[0.08] px-1.5 py-0.5 rounded")}>
                            {node.label}
                            <span className="text-[#555] text-[10px] ml-2">
                              {nodeData.folder.total_runs} runs
                            </span>
                          </span>
                        );
                      }

                      const file = (nodeData && "kind" in nodeData ? (nodeData as any).file : nodeData) as ProjectFile | undefined;
                      if (!file) return node.label;

                      let color = "text-white"; // HVAC Non-Magnetic default
                      let bgColor = "";

                      if (file.category === "cable") {
                        if (file.sub_type === "dc_bipole") {
                          color = "text-yellow-400";
                          bgColor = "bg-yellow-400/[0.15]";
                        } else {
                          // HVAC — maroon for non-magnetic (default)
                          color = "text-rose-800";
                          bgColor = "bg-rose-800/[0.15]";
                        }
                      } else if (file.category === "wmm") {
                        if (file.sub_type === "line") {
                          color = "text-yellow-400";
                          bgColor = "bg-yellow-400/[0.15]";
                        } else {
                          // grid or unset
                          color = "text-purple-400";
                          bgColor = "bg-purple-400/[0.15]";
                        }
                      }

                      return (
                        <span className={cn(color, bgColor, bgColor && "px-1.5 py-0.5 rounded")}>
                          {node.label}
                        </span>
                      );
                    }}
                    defaultExpandedIds={FOLDERS.map((f) => `folder-${f.id}`)}
                    showLines
                    showIcons
                    className="bg-[#0d0d0d]"
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right side — canvas + form panel stacked */}
        <div className="flex-1 relative" style={{ maxWidth: activeBatch ? "72rem" : undefined }} ref={formPanelRef}>

          {/* Workflow Canvas — base layer */}
          <AnimatePresence>
            {canvasOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="h-[calc(100vh-164px)] px-[7px]"
              >
                <div className={cn(
                  "h-full transition-all duration-300",
                  (showHvacForm || showDcForm || showWmmForm || editingFile || activeBatch || showBatchWizard || treeOpen)
                    ? "blur-sm opacity-60" : "",
                )}>
                  <WorkflowCanvas
                    ref={canvasRef}
                    projectId={projectId}
                    projectType={projectType}
                    files={files}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form panel — floats above canvas */}
          <div className={canvasOpen ? "absolute inset-0 z-10 pointer-events-none [&>*]:pointer-events-auto" : ""} style={canvasOpen ? {} : { maxWidth: activeBatch ? "72rem" : "42rem" }}>

          {/* HVAC Create */}
          {showHvacForm && (
            <HvacForm
              onClose={() => setShowHvacForm(false)}
              onSave={async (data) => {
                const create = isTeam ? createTeamFile : createLocalFile;
                const file = await create(projectId, "cable", "hvac");
                await saveFileData(projectId, file.id, {
                  name: data.name, tag: data.tag, magnetic: data.magnetic, params: data.values,
                });
                setFiles((prev) => [...prev, file]);
                await loadFiles();
              }}
            />
          )}

          {/* HVAC Edit */}
          {editingFile && editingFileData && editingFile.category === "cable" && editingFile.sub_type === "hvac" && (
            <HvacForm
              key={editingFile.id}
              onClose={() => { setEditingFile(null); setEditingFileData(null); }}
              readOnly={!canEdit}
              existingFile={{
                name: editingFileData.name ?? editingFile.name,
                tag: editingFileData.tag ?? "",
                magnetic: editingFileData.magnetic ?? false,
                values: editingFileData.params ?? {},
              }}
              onSave={async (data) => {
                await saveFileData(projectId, editingFile.id, {
                  name: data.name, tag: data.tag, magnetic: data.magnetic, params: data.values,
                });
                await loadFiles();
              }}
            />
          )}

          {/* DC Bipole Create */}
          {showDcForm && (
            <DCBipoleForm
              onClose={() => setShowDcForm(false)}
              onSave={async (data) => {
                const create = isTeam ? createTeamFile : createLocalFile;
                const file = await create(projectId, "cable", "dc_bipole");
                await saveFileData(projectId, file.id, {
                  name: data.name, tag: data.tag, params: data.values,
                });
                setFiles((prev) => [...prev, file]);
                await loadFiles();
              }}
            />
          )}

          {/* DC Bipole Edit */}
          {editingFile && editingFileData && editingFile.category === "cable" && editingFile.sub_type === "dc_bipole" && (
            <DCBipoleForm
              key={editingFile.id}
              onClose={() => { setEditingFile(null); setEditingFileData(null); }}
              readOnly={!canEdit}
              existingFile={{
                name: editingFileData.name ?? editingFile.name,
                tag: editingFileData.tag ?? "",
                values: editingFileData.params ?? {},
              }}
              onSave={async (data) => {
                await saveFileData(projectId, editingFile.id, {
                  name: data.name, tag: data.tag, params: data.values,
                });
                await loadFiles();
              }}
            />
          )}

          {/* WMM Create */}
          {showWmmForm && (
            <WMMForm
              onClose={() => setShowWmmForm(false)}
              initialMode={wmmCreateMode}
              isTeam={isTeam}
              onSave={async (data) => {
                const create = isTeam ? createTeamFile : createLocalFile;
                const file = await create(projectId, "wmm", wmmCreateMode);
                await saveFileData(projectId, file.id, {
                  name: data.name, tag: data.tag,
                  params: { ...data.values, mode: data.mode, coordinates: data.coordinates ?? "", waypoints: data.waypoints ?? "" },
                });
                setFiles((prev) => [...prev, file]);
                await loadFiles();
              }}
            />
          )}

          {/* WMM Edit */}
          {editingFile && editingFileData && editingFile.category === "wmm" && (
            <WMMForm
              key={editingFile.id}
              onClose={() => { setEditingFile(null); setEditingFileData(null); }}
              readOnly={!canEdit}
              isTeam={isTeam}
              existingFile={{
                name: editingFileData.name ?? editingFile.name,
                tag: editingFileData.tag ?? "",
                mode: editingFileData.params?.mode ?? "grid",
                values: editingFileData.params ?? {},
                coordinates: editingFileData.params?.coordinates ?? "",
                waypoints: editingFileData.params?.waypoints ?? "",
              }}
              onSave={async (data) => {
                await saveFileData(projectId, editingFile.id, {
                  name: data.name, tag: data.tag,
                  params: { ...data.values, mode: data.mode, coordinates: data.coordinates ?? "", waypoints: data.waypoints ?? "" },
                });
                await loadFiles();
              }}
            />
          )}

          {/* Batch Explorer */}
          {activeBatch && (
            <BatchExplorer
              key={activeBatch.folder.id}
              projectId={projectId}
              batchFolder={activeBatch.folder}
              parentFile={activeBatch.parentFile}
              onClose={() => switchToForm({})}
              onFileOpen={async (fileId) => {
                const file = files.find((f) => f.id === fileId);
                if (file) await openFileForEdit(file);
              }}
              onLoadToFlow={async (selectedFiles, mode) => {
                if (!canvasOpen) setCanvasOpen(true);
                const delay = canvasOpen ? 0 : 300;

                if (mode === "batch" && selectedFiles.length > 1) {
                  // Determine batch node type from parent file
                  const parentSub = activeBatch!.parentFile.sub_type;
                  const batchMode = activeBatch!.folder.batch_mode;
                  let batchDefType = "batch-hvac-nonmag";
                  if (parentSub === "hvac") {
                    // Check if any file is magnetic
                    const hasMagnetic = selectedFiles.some((f) => {
                      // Check from allRuns or folder metadata
                      return activeBatch!.folder.batch_mode === "magnetic";
                    });
                    const hasMixed = batchMode === "magnetic" || batchMode === "non_magnetic";
                    if (batchMode === "magnetic") {
                      batchDefType = "batch-hvac-mixed";
                    } else {
                      batchDefType = "batch-hvac-nonmag";
                    }
                  } else if (parentSub === "dc_bipole") {
                    if (batchMode === "location") {
                      batchDefType = "batch-dc-location";
                    } else {
                      batchDefType = "batch-dc-cable";
                    }
                  }

                  setTimeout(() => {
                    canvasRef.current?.addBatchNode(
                      batchDefType,
                      selectedFiles.map((f) => f.id),
                      `Batch (${selectedFiles.length} files)`,
                    );
                  }, delay);
                } else {
                  // Load each file as individual node
                  for (const f of selectedFiles) {
                    let data: Record<string, any> = {};
                    try { data = await getFileData(projectId, f.id) ?? {}; } catch { /* skip */ }
                    setTimeout(() => {
                      canvasRef.current?.addFileNode(f, data);
                    }, delay);
                  }
                }
              }}
            />
          )}

          {/* Batch Wizard */}
          {showBatchWizard && (
            <BatchWizard
              projectId={projectId}
              parentFile={showBatchWizard.parentFile}
              parentFileData={showBatchWizard.parentData}
              onClose={() => switchToForm({})}
              onCreated={() => {
                switchToForm({});
                loadFiles();
              }}
            />
          )}
        </div>{/* close form float */}
        </div>{/* close right side */}
        </div>{/* close flex row */}
      </main>
    </div>
  );
}
