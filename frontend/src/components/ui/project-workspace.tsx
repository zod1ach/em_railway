import { useState, useEffect, useCallback, useMemo } from "react";
import { Cable, Globe, File } from "lucide-react";
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
import {
  getLocalFiles, createLocalFile, deleteLocalFile,
  getTeamFiles, createTeamFile, deleteTeamFile,
  getLocalFileData, saveLocalFileData,
  getTeamFileData, saveTeamFileData,
} from "@/lib/project-files";
import type { ProjectFile, FileCategory, CableSubType } from "@/types/project-files";
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
  const [loading, setLoading] = useState(true);
  const [treeOpen, setTreeOpen] = useState(true);
  const [cablePickerOpen, setCablePickerOpen] = useState(false);
  const [showHvacForm, setShowHvacForm] = useState(false);
  const [showDcForm, setShowDcForm] = useState(false);
  const [showWmmForm, setShowWmmForm] = useState(false);
  const [wmmPickerOpen, setWmmPickerOpen] = useState(false);
  const [wmmCreateMode, setWmmCreateMode] = useState<"grid" | "line">("grid");

  const isTeam = projectType === "team";
  const canEdit = !isTeam || myRole === "Owner" || myRole === "Editor";

  /* ── Load files ── */
  const loadFiles = useCallback(async () => {
    try {
      const data = isTeam
        ? await getTeamFiles(projectId)
        : await getLocalFiles(projectId);
      setFiles(data);
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

  /* ── Build tree data ── */
  const treeData: TreeNode[] = useMemo(() => {
    return FOLDERS.map((folder) => {
      const folderFiles = files.filter((f) => f.category === folder.id);
      const children: TreeNode[] = folderFiles.map((f) => ({
        id: f.id,
        label: f.name,
        icon: <File className="h-4 w-4" style={{ color: getFileIconColor(f) }} />,
        data: f,
      }));
      return {
        id: `folder-${folder.id}`,
        label: folder.label,
        icon: folder.icon,
        children,
      };
    });
  }, [files]);

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
  };

  const openFileForEdit = async (file: ProjectFile) => {
    closeAllForms();
    try {
      const data = await getFileData(projectId, file.id);
      setEditingFileData(data);
    } catch {
      setEditingFileData({});
    }
    setEditingFile(file);
  };

  const handleNodeClick = async (node: TreeNode) => {
    if (node.data) {
      const file = node.data as ProjectFile;
      if (file.category === "cable" || file.category === "wmm") {
        await openFileForEdit(file);
      } else {
        onSelectFile(file.id, file.name);
      }
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
                <div className="w-fit">
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
                      const file = node.data as ProjectFile;
                      if (isTeam && myRole !== "Owner") return null;

                      return (
                        <HoldDeleteButton
                          onDelete={async () => {
                            if (isTeam) {
                              await deleteTeamFile(projectId, file.id);
                            } else {
                              await deleteLocalFile(projectId, file.id);
                            }
                            setFiles((prev) => prev.filter((f) => f.id !== file.id));
                            if (editingFile?.id === file.id) {
                              setEditingFile(null);
                              setEditingFileData(null);
                            }
                          }}
                          holdDuration={3000}
                        />
                      );
                    }}
                    renderLabel={(node, isFolder) => {
                      if (isFolder) return node.label;
                      const file = node.data as ProjectFile | undefined;
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
        <div className="flex-1 max-w-2xl">
          {/* HVAC Create */}
          <AnimatePresence>
            {showHvacForm && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <HvacForm
                  onClose={() => setShowHvacForm(false)}
                  onSave={async (data) => {
                    const create = isTeam ? createTeamFile : createLocalFile;
                    const file = await create(projectId, "cable", "hvac");
                    {
                      await saveFileData(projectId, file.id, {
                        name: data.name,
                        tag: data.tag,
                        magnetic: data.magnetic,
                        params: data.values,
                      });
                    }
                    setFiles((prev) => [...prev, file]);
                    await loadFiles();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* HVAC Edit */}
          <AnimatePresence>
            {editingFile && editingFileData && editingFile.category === "cable" && editingFile.sub_type === "hvac" && (
              <motion.div
                key={editingFile.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <HvacForm
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
                      name: data.name,
                      tag: data.tag,
                      magnetic: data.magnetic,
                      params: data.values,
                    });
                    await loadFiles();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* DC Bipole Create */}
          <AnimatePresence>
            {showDcForm && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <DCBipoleForm
                  onClose={() => setShowDcForm(false)}
                  onSave={async (data) => {
                    const create = isTeam ? createTeamFile : createLocalFile;
                    const file = await create(projectId, "cable", "dc_bipole");
                    {
                      await saveFileData(projectId, file.id, {
                        name: data.name,
                        tag: data.tag,
                        params: data.values,
                      });
                    }
                    setFiles((prev) => [...prev, file]);
                    await loadFiles();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* DC Bipole Edit */}
          <AnimatePresence>
            {editingFile && editingFileData && editingFile.category === "cable" && editingFile.sub_type === "dc_bipole" && (
              <motion.div
                key={editingFile.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
            >
              <DCBipoleForm
                onClose={() => { setEditingFile(null); setEditingFileData(null); }}
                readOnly={!canEdit}
                existingFile={{
                  name: editingFileData.name ?? editingFile.name,
                  tag: editingFileData.tag ?? "",
                  values: editingFileData.params ?? {},
                }}
                onSave={async (data) => {
                  await saveFileData(projectId, editingFile.id, {
                    name: data.name,
                    tag: data.tag,
                    params: data.values,
                  });
                  await loadFiles();
                }}
              />
            </motion.div>
          )}
          </AnimatePresence>

          {/* WMM Create */}
          <AnimatePresence>
            {showWmmForm && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <WMMForm
                  onClose={() => setShowWmmForm(false)}
                  initialMode={wmmCreateMode}
                  isTeam={isTeam}
                  onSave={async (data) => {
                    const create = isTeam ? createTeamFile : createLocalFile;
                    const file = await create(projectId, "wmm", wmmCreateMode);
                    {
                      await saveFileData(projectId, file.id, {
                        name: data.name,
                        tag: data.tag,
                        params: { ...data.values, mode: data.mode, coordinates: data.coordinates ?? "", waypoints: data.waypoints ?? "" },
                      });
                    }
                    setFiles((prev) => [...prev, file]);
                    await loadFiles();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* WMM Edit */}
          <AnimatePresence>
            {editingFile && editingFileData && editingFile.category === "wmm" && (
              <motion.div
                key={editingFile.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.25 }}
              >
                <WMMForm
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
                      name: data.name,
                      tag: data.tag,
                      params: { ...data.values, mode: data.mode, coordinates: data.coordinates ?? "", waypoints: data.waypoints ?? "" },
                    });
                    await loadFiles();
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>{/* close flex row */}
      </main>
    </div>
  );
}
