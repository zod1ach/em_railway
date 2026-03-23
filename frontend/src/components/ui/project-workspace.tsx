import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Cable, Globe, File, Package } from "lucide-react";
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
        <div className="w-full px-12 h-16 flex items-center">
          <Breadcrumbs
            items={[
              { label: "Projects", onClick: onGoToProjects },
              { label: projectName },
            ]}
          />
        </div>
      </header>

      {/* Main content — tree on left, form on right */}
      <main className="flex-1 px-12 py-6">
        {/* Hamburger toggle */}
        <button
          onClick={() => setTreeOpen((v) => !v)}
          className="mb-3 cursor-none"
        >
          <svg viewBox="0 0 40 40" fill="none" style={{ width: 20, height: 20 }}>
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
                <div className="w-fit" ref={treeRef}>
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
                      // Batch folder nodes get their own delete button
                      if ("kind" in nodeData && nodeData.kind === "batch-folder") {
                        return (
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
                        );
                      }
                      const file = ("kind" in nodeData && nodeData.kind === "file") ? nodeData.file : nodeData as ProjectFile;
                      if (isTeam && myRole !== "Owner") return null;

                      return (
                        <div className="flex items-center gap-0.5">
                          {/* Batch button — only for cable files in personal mode */}
                          {!isTeam && file.category === "cable" && !file.batch_folder_id && (
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

        {/* Form panel — right side, aligned with top of tree */}
        <div className="flex-1" style={{ maxWidth: activeBatch ? "72rem" : "42rem" }} ref={formPanelRef}>

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
        </div>
        </div>{/* close flex row */}
      </main>
    </div>
  );
}
