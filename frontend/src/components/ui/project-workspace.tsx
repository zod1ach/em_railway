import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Minus, Plus, ChevronDown, Trash2, Settings, Cable, Globe, Waves,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectAvatar } from "@/components/ui/project-avatar";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { FileCreatorPill } from "@/components/ui/file-creator-pill";
import {
  getLocalFiles, createLocalFile, deleteLocalFile,
  getTeamFiles, createTeamFile, deleteTeamFile,
} from "@/lib/project-files";
import type { ProjectFile, FileCategory, CableSubType } from "@/types/project-files";
import { TEAM_FILE_LIMIT } from "@/types/project-files";

const snappySpring = { type: "spring", stiffness: 350, damping: 30, mass: 1 } as const;

interface ProjectWorkspaceProps {
  projectId: string;
  projectName: string;
  projectType: "local" | "team";
  myRole?: "Owner" | "Editor" | "Viewer";
  onGoToProjects: () => void;
  onSelectFile: (fileId: string, fileName: string) => void;
  onOpenSettings?: () => void;
}

const categoryConfig: { id: FileCategory; label: string; icon: typeof Cable }[] = [
  { id: "cable", label: "Cable Model", icon: Cable },
  { id: "wmm", label: "WMM Geomagnetic", icon: Globe },
  { id: "bathymetry", label: "Bathymetry", icon: Waves },
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
  const [allCollapsed, setAllCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<FileCategory, boolean>>({
    cable: false,
    wmm: false,
    bathymetry: false,
  });
  const [deleteTarget, setDeleteTarget] = useState<ProjectFile | null>(null);

  const isTeam = projectType === "team";
  const canEdit = !isTeam || myRole === "Owner" || myRole === "Editor";

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

  const handleCreateFile = async (category: FileCategory, subType?: CableSubType) => {
    const file = isTeam
      ? await createTeamFile(projectId, category, subType)
      : await createLocalFile(projectId, category, subType);
    setFiles((prev) => [...prev, file]);
  };

  const handleDeleteFile = async () => {
    if (!deleteTarget) return;
    try {
      if (isTeam) {
        await deleteTeamFile(projectId, deleteTarget.id);
      } else {
        await deleteLocalFile(projectId, deleteTarget.id);
      }
      setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));
    } finally {
      setDeleteTarget(null);
    }
  };

  const toggleAllCollapsed = () => {
    const newState = !allCollapsed;
    setAllCollapsed(newState);
    setCollapsedSections({ cable: newState, wmm: newState, bathymetry: newState });
  };

  const toggleSection = (category: FileCategory) => {
    setCollapsedSections((prev) => ({ ...prev, [category]: !prev[category] }));
  };

  const filesByCategory = (category: FileCategory) =>
    files.filter((f) => f.category === category);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="w-full px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display text-[22px] tracking-[0.2em] text-foreground">ELECTROFISH</span>
            <div className="w-px h-6 bg-border-accent" />
            <Breadcrumbs
              items={[
                { label: "Projects", onClick: onGoToProjects },
                { label: projectName },
              ]}
            />
          </div>
          {isTeam && myRole === "Owner" && onOpenSettings && (
            <button
              onClick={onOpenSettings}
              data-magnetic
              className="p-2 rounded-xl text-[#888] hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-none"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="px-12 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canEdit && (
            <FileCreatorPill
              onCreateFile={handleCreateFile}
              disabled={!canEdit}
              fileCount={isTeam ? files.length : undefined}
              fileLimit={isTeam ? TEAM_FILE_LIMIT : undefined}
            />
          )}
          <motion.button
            layout
            transition={snappySpring}
            onClick={toggleAllCollapsed}
            data-magnetic
            className="flex items-center gap-1.5 rounded-3xl bg-[#1c1c1c] px-3 py-2 text-[#888] hover:text-white transition-colors cursor-none"
          >
            {allCollapsed ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
          </motion.button>
        </div>
      </div>

      <main className="flex-1 px-12 pb-12 space-y-6">
        {loading ? (
          <div className="space-y-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-3">
                <div className="h-10 w-48 bg-[#1c1c1c] rounded-xl animate-pulse" />
                <div className="grid grid-cols-3 gap-4">
                  {[0, 1, 2].map((j) => (
                    <div key={j} className="h-24 bg-[#111] border border-[#222] rounded-2xl animate-pulse" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          categoryConfig.map((cat) => {
            const catFiles = filesByCategory(cat.id);
            const isCollapsed = collapsedSections[cat.id];

            return (
              <div key={cat.id}>
                <button
                  onClick={() => toggleSection(cat.id)}
                  data-magnetic
                  className="flex items-center gap-3 mb-3 group cursor-none"
                >
                  <cat.icon className={cn("w-4 h-4", isCollapsed ? "text-[#888]" : "text-white")} />
                  <span className={cn(
                    "text-sm font-medium transition-colors",
                    isCollapsed ? "text-[#888] group-hover:text-white" : "text-white"
                  )}>
                    {cat.label}
                  </span>
                  <span className="text-xs text-[#555] bg-[#1c1c1c] px-2 py-0.5 rounded-full">
                    {catFiles.length}
                  </span>
                  <motion.div
                    animate={{ rotate: isCollapsed ? -90 : 0 }}
                    transition={snappySpring}
                  >
                    <ChevronDown className="w-3.5 h-3.5 text-[#555]" />
                  </motion.div>
                </button>

                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={snappySpring}
                      className="overflow-hidden"
                    >
                      {catFiles.length === 0 ? (
                        <div className="border border-dashed border-[#333] rounded-2xl p-8 text-center">
                          <span className="text-sm text-[#555]">No files yet</span>
                        </div>
                      ) : (
                        <motion.div layout transition={snappySpring} className="grid grid-cols-3 gap-4">
                          {catFiles.map((file) => (
                            <FileCard
                              key={file.id}
                              file={file}
                              canDelete={canEdit}
                              onClick={() => onSelectFile(file.id, file.name)}
                              onDelete={() => setDeleteTarget(file)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </main>

      <footer className="border-t border-border bg-surface/80 backdrop-blur-sm h-10 flex items-center justify-between px-12">
        <span className="text-[11px] text-muted">University of Southampton — EPE Research Group</span>
        <span className="font-mono text-[11px] text-muted">2026</span>
      </footer>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteFile}
        mode="destructive"
        name={deleteTarget?.name ?? ""}
        itemType="file"
      />
    </div>
  );
}

interface FileCardProps {
  file: ProjectFile;
  canDelete: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function FileCard({ file, canDelete, onClick, onDelete }: FileCardProps) {
  const typeLabel = file.category === "cable"
    ? (file.sub_type === "dc_bipole" ? "DC Bipole" : "HVAC")
    : file.category === "wmm"
      ? "WMM"
      : "Bathymetry";

  const dateStr = new Date(file.created_at).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className="group relative bg-[#111] border border-[#222] hover:border-[#333] rounded-2xl p-4 transition-colors cursor-none"
      data-magnetic
    >
      <div className="flex items-start gap-3">
        <ProjectAvatar projectId={file.id} className="w-10 h-10 rounded-xl flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{file.name}</p>
          <p className="text-xs text-[#888]">
            {typeLabel}
            <span className="text-[#555]"> · {dateStr}</span>
          </p>
        </div>
      </div>

      {canDelete && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-magnetic
            className="p-1.5 rounded-lg text-[#666] hover:text-error hover:bg-[#222] transition-colors cursor-none"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </motion.div>
  );
}
