import { useState } from "react";
import {
  motion,
  LayoutGroup,
  AnimatePresence,
  type Transition,
} from "motion/react";
import {
  User,
  Users,
  LayoutList,
  LayoutGrid,
  Plus,
  Crown,
  Pencil,
  Eye,
  Trash2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/profiles";
import { ProjectAvatar } from "@/components/ui/project-avatar";
import { CollaboratorAvatars, type Collaborator } from "@/components/ui/collaborator-avatars";
import { DownloadButton } from "@/components/ui/download-button";
import { PROJECT_LIMITS, deleteTeamProject, type ProjectWithOwner } from "@/lib/projects";
import { deleteLocalProject, downloadProject, type LocalProject } from "@/lib/local-db";
import { ProjectSettingsModal } from "@/components/ui/project-settings-modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/* ── Animation presets ── */

const snappySpring: Transition = {
  type: "spring",
  stiffness: 350,
  damping: 30,
  mass: 1,
};

const fastFade: Transition = {
  duration: 0.1,
  ease: "linear",
};

/* ── Types ── */

type ViewMode = "list" | "card";
type Category = "personal" | "team";

interface ProjectsCollectionProps {
  teamProjects: ProjectWithOwner[];
  localProjects: LocalProject[];
  ownedCount: number;
  onSelectProject: (projectId: string, projectType: "local" | "team", projectName: string) => void;
  onCreateTeamProject: () => void;
  onCreateLocalProject: () => void;
  onLocalProjectsChange: () => void;
}

/* ── Role config ── */

const ROLE_CONFIG = {
  Owner: { icon: Crown, label: "Owner", color: "text-yellow-500" },
  Editor: { icon: Pencil, label: "Editor", color: "text-accent" },
  Viewer: { icon: Eye, label: "Viewer", color: "text-blue-400" },
} as const;

/* ── Main component ── */

export function ProjectsCollection({
  teamProjects,
  localProjects,
  ownedCount,
  onSelectProject,
  onCreateTeamProject,
  onCreateLocalProject,
  onLocalProjectsChange,
}: ProjectsCollectionProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [category, setCategory] = useState<Category>("personal");

  // Settings modal state
  const [settingsLocal, setSettingsLocal] = useState<LocalProject | null>(null);
  const [settingsTeam, setSettingsTeam] = useState<ProjectWithOwner | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LocalProject | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<ProjectWithOwner | null>(null);

  const isPersonal = category === "personal";
  const teamAtLimit = ownedCount >= PROJECT_LIMITS.team_created;

  const handleDelete = async (id: string) => {
    await deleteLocalProject(id);
    onLocalProjectsChange();
  };

  const handleExport = async (id: string) => {
    await downloadProject(id);
  };

  return (
    <div className="w-full p-6 pt-16 md:p-10 md:pt-16 font-sans selection:bg-accent/10">
      <div className="flex flex-col gap-6">
        {/* Header row: category tabs + controls */}
        <div className="flex items-center gap-3">
          {/* Category tabs */}
          <div className="flex p-1 bg-[#111] rounded-full w-fit border border-[#222]">
            <CategoryTab
              active={category === "personal"}
              onClick={() => setCategory("personal")}
              icon={User}
              label="Personal"
            />
            <CategoryTab
              active={category === "team"}
              onClick={() => setCategory("team")}
              icon={Users}
              label="Team"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex p-1 bg-[#111] rounded-full border border-[#222]">
            <ViewToggle active={view === "list"} onClick={() => setView("list")} icon={LayoutList} />
            <ViewToggle active={view === "card"} onClick={() => setView("card")} icon={LayoutGrid} />
          </div>

          {/* Create button */}
          <button
            onClick={() => isPersonal ? onCreateLocalProject() : (!teamAtLimit && onCreateTeamProject())}
            disabled={!isPersonal && teamAtLimit}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-full transition-all cursor-none",
              (!isPersonal && teamAtLimit)
                ? "bg-[#111] border border-[#222] text-[#555] cursor-not-allowed"
                : "bg-white text-black hover:bg-white/90"
            )}
            title={
              isPersonal
                ? "New personal project"
                : teamAtLimit
                  ? `Limit reached (${ownedCount}/${PROJECT_LIMITS.team_created})`
                  : "New team project"
            }
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-px bg-[#222] w-full" />

        {/* Content Section */}
        <div className="relative min-h-[200px]">
          <AnimatePresence mode="wait">
            {isPersonal ? (
              /* ── Personal projects (local SQLite) ── */
              localProjects.length === 0 ? (
                <motion.div
                  key="empty-personal"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <button
                    onClick={onCreateLocalProject}
                    className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors cursor-none"
                  >
                    <Plus className="w-4 h-4" />
                    New Personal Project
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="personal-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full"
                >
                  <LayoutGroup>
                    <motion.div
                      layout
                      transition={snappySpring}
                      className="w-full grid grid-cols-3 gap-4"
                    >
                      {localProjects.map((project) => (
                        <LocalProjectCard
                          key={project.id}
                          project={project}
                          view={view}
                          onClick={() => onSelectProject(project.id, "local", project.name)}
                          onExport={() => handleExport(project.id)}
                          onDelete={() => setDeleteTarget(project)}
                          onSettings={() => setSettingsLocal(project)}
                        />
                      ))}
                    </motion.div>
                  </LayoutGroup>
                </motion.div>
              )
            ) : (
              /* ── Team projects (Supabase) ── */
              teamProjects.length === 0 ? (
                <motion.div
                  key="empty-team"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="flex flex-col items-center justify-center py-16"
                >
                  <button
                    onClick={onCreateTeamProject}
                    disabled={teamAtLimit}
                    className={cn(
                      "flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-xl transition-colors cursor-none",
                      teamAtLimit
                        ? "bg-[#111] border border-[#222] text-[#555]"
                        : "bg-white text-black hover:bg-white/90"
                    )}
                  >
                    <Plus className="w-4 h-4" />
                    {teamAtLimit ? "Limit reached" : "Create Team Project"}
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="team-content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="w-full"
                >
                  <LayoutGroup>
                    <motion.div
                      layout
                      transition={snappySpring}
                      className="w-full grid grid-cols-3 gap-4"
                    >
                      {teamProjects.map((project) => (
                        <TeamProjectCard
                          key={project.id}
                          project={project}
                          view={view}
                          onClick={() => onSelectProject(project.id, "team", project.name)}
                          onSettings={() => setSettingsTeam(project)}
                          onDelete={() => setDeleteTeamTarget(project)}
                        />
                      ))}
                    </motion.div>
                  </LayoutGroup>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Settings modal — local project */}
      <ProjectSettingsModal
        open={!!settingsLocal}
        onClose={() => setSettingsLocal(null)}
        mode="local"
        localProject={settingsLocal ?? undefined}
        onSaved={onLocalProjectsChange}
      />

      {/* Settings modal — team project */}
      <ProjectSettingsModal
        open={!!settingsTeam}
        onClose={() => setSettingsTeam(null)}
        mode="team"
        teamProjectId={settingsTeam?.id}
        teamProjectName={settingsTeam?.name}
        teamProjectDescription={settingsTeam?.description}
        onSaved={onLocalProjectsChange}
      />

      {/* Delete confirmation — local project */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        mode="destructive"
        name={deleteTarget?.name ?? ""}
        itemType="project"
        onConfirm={async () => {
          if (deleteTarget) {
            await handleDelete(deleteTarget.id);
            setDeleteTarget(null);
          }
        }}
      />

      {/* Delete confirmation — team project */}
      <ConfirmDialog
        open={!!deleteTeamTarget}
        onClose={() => setDeleteTeamTarget(null)}
        mode="destructive"
        name={deleteTeamTarget?.name ?? ""}
        itemType="project"
        onConfirm={async () => {
          if (deleteTeamTarget) {
            await deleteTeamProject(deleteTeamTarget.id);
            setDeleteTeamTarget(null);
            onLocalProjectsChange();
          }
        }}
      />
    </div>
  );
}

/* ── Local Project Card ── */

function LocalProjectCard({
  project,
  view,
  onClick,
  onExport,
  onDelete,
  onSettings,
}: {
  project: LocalProject;
  view: ViewMode;
  onClick: () => void;
  onExport: () => void;
  onDelete: () => void;
  onSettings: () => void;
}) {
  return (
    <motion.div
      layout
      transition={snappySpring}
      onClick={onClick}
      className={cn(
        "relative flex items-center z-10 group cursor-none",
        view === "list" && "flex-row gap-4 w-full",
        view === "card" && "flex-col gap-3 w-full items-start"
      )}
    >
      <motion.div
        layout
        transition={snappySpring}
        className={cn(
          "shrink-0",
          view === "list" && "w-14 h-14",
          view === "card" && "w-full h-20"
        )}
      >
        <ProjectAvatar projectId={project.id} className="w-full h-full" />
      </motion.div>

      <motion.div
        layout
        transition={fastFade}
        className={cn(
          "flex flex-1 justify-between items-center min-w-0",
          view === "card" ? "w-full px-1" : "px-0"
        )}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <motion.h3
            layout
            className="font-medium text-[15px] text-white leading-tight truncate group-hover:text-accent transition-colors"
          >
            {project.name}
          </motion.h3>
          <span className="text-[10px] text-[#555]">
            {new Date(project.updated_at).toLocaleDateString()}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
          <button
            onClick={(e) => { e.stopPropagation(); onSettings(); }}
            className="p-1.5 rounded-lg hover:bg-[#222] text-[#666] hover:text-white transition-colors cursor-none"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
          <DownloadButton onClick={onExport} size={16} />
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#666] hover:text-red-400 transition-colors cursor-none"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      {view === "list" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute -bottom-1.5 left-[4.5rem] right-0 h-px bg-[#1a1a1a]"
        />
      )}
    </motion.div>
  );
}

/* ── Team Project Card ── */

function TeamProjectCard({
  project,
  view,
  onClick,
  onSettings,
  onDelete,
}: {
  project: ProjectWithOwner;
  view: ViewMode;
  onClick: () => void;
  onSettings: () => void;
  onDelete: () => void;
}) {
  const avatarSrc = project.owner_profile
    ? getAvatarUrl(project.owner_profile.avatar_style, project.owner_profile.avatar_seed)
    : undefined;

  const role = project.my_role ?? "Viewer";
  const roleConfig = ROLE_CONFIG[role];
  const RoleIcon = roleConfig.icon;

  return (
    <motion.div
      layout
      transition={snappySpring}
      onClick={onClick}
      className={cn(
        "relative flex items-center z-10 group cursor-none",
        view === "list" && "flex-row gap-4 w-full",
        view === "card" && "flex-col gap-3 w-full items-start"
      )}
    >
      <motion.div
        layout
        transition={snappySpring}
        className={cn(
          "shrink-0",
          view === "list" && "w-14 h-14",
          view === "card" && "w-full h-20"
        )}
      >
        <ProjectAvatar projectId={project.id} className="w-full h-full" />
      </motion.div>

      <motion.div
        layout
        transition={fastFade}
        className={cn(
          "flex flex-1 justify-between items-center min-w-0",
          view === "card" ? "w-full px-1" : "px-0"
        )}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <motion.h3
            layout
            className="font-medium text-[15px] text-white leading-tight truncate group-hover:text-accent transition-colors"
          >
            {project.name}
          </motion.h3>
          <motion.div
            layout
            className="text-[#888] font-medium text-xs flex items-center gap-1.5"
          >
            {avatarSrc && (
              <img
                src={avatarSrc}
                alt=""
                className="w-3.5 h-3.5 rounded-full bg-white shrink-0"
              />
            )}
            <span className="truncate">
              {project.owner_profile?.full_name ?? "Unknown"}
            </span>
          </motion.div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-2">
          {/* Role badge */}
          <motion.div
            layout
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-wider",
              roleConfig.color
            )}
          >
            <RoleIcon className="w-2.5 h-2.5" />
            <span>{roleConfig.label}</span>
          </motion.div>

          {/* Collaborator avatars */}
          {project.collaborators && project.collaborators.length > 0 && (
            <CollaboratorAvatars collaborators={project.collaborators} maxShow={3} />
          )}

          {/* Settings + Delete — only visible to Owner */}
          {role === "Owner" && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onSettings(); }}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-[#222] text-[#666] hover:text-white transition-all cursor-none"
                title="Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[#666] hover:text-red-400 transition-all cursor-none"
                title="Delete project"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </motion.div>

      {view === "list" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute -bottom-1.5 left-[4.5rem] right-0 h-px bg-[#1a1a1a]"
        />
      )}
    </motion.div>
  );
}

/* ── Category Tab ── */

function CategoryTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all rounded-full outline-none cursor-none",
        active
          ? "text-black"
          : "text-[#888] hover:text-white hover:bg-[#1a1a1a]"
      )}
    >
      {active && (
        <motion.div
          layoutId="active-category"
          className="absolute inset-0 bg-white rounded-full shadow-md"
          transition={snappySpring}
        />
      )}
      <span className="relative z-10 flex items-center gap-2">
        <Icon
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            active && "scale-110"
          )}
        />
        {label}
      </span>
    </button>
  );
}

/* ── View Toggle (icon-only) ── */

function ViewToggle({
  active,
  onClick,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LayoutList;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-8 h-8 flex items-center justify-center rounded-full transition-all outline-none cursor-none",
        active ? "text-black" : "text-[#666] hover:text-white"
      )}
    >
      {active && (
        <motion.div
          layoutId="active-view"
          className="absolute inset-0 bg-white rounded-full"
          transition={snappySpring}
        />
      )}
      <Icon className="w-3.5 h-3.5 relative z-10" />
    </button>
  );
}

export default ProjectsCollection;
