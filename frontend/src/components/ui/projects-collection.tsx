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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAvatarUrl } from "@/lib/profiles";
import { PROJECT_LIMITS, type ProjectWithOwner } from "@/lib/projects";

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
  personalProjects: ProjectWithOwner[];
  teamProjects: ProjectWithOwner[];
  personalCount: number;
  teamCount: number;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (type: "personal" | "team") => void;
}

/* ── Main component ── */

export function ProjectsCollection({
  personalProjects,
  teamProjects,
  personalCount,
  teamCount,
  onSelectProject,
  onCreateProject,
}: ProjectsCollectionProps) {
  const [view, setView] = useState<ViewMode>("list");
  const [category, setCategory] = useState<Category>("personal");

  const items = category === "personal" ? personalProjects : teamProjects;
  const count = category === "personal" ? personalCount : teamCount;
  const limit = PROJECT_LIMITS[category];
  const atLimit = count >= limit;

  return (
    <div className="w-full max-w-2xl mx-auto p-4 md:p-8 font-sans selection:bg-accent/10">
      <div className="flex flex-col gap-6">
        {/* Header row: category tabs + view mode toggle */}
        <div className="flex items-center justify-between">
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
        </div>

        <div className="h-px bg-[#222] w-full" />

        {/* Content Section */}
        <div className="relative min-h-[350px] flex flex-col items-center">
          <AnimatePresence mode="wait">
            {items.length === 0 ? (
              /* Empty state */
              <motion.div
                key="empty"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <button
                  onClick={() => onCreateProject(category)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black text-sm font-medium rounded-xl hover:bg-white/90 transition-colors cursor-none"
                >
                  <Plus className="w-4 h-4" />
                  New {category === "personal" ? "Personal" : "Team"} Project
                </button>
              </motion.div>
            ) : (
              /* Project grid/list */
              <motion.div
                key={`content-${category}`}
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
                    className={cn(
                      "w-full relative",
                      view === "list" && "flex flex-col gap-3",
                      view === "card" && "grid grid-cols-2 gap-4"
                    )}
                  >
                    {items.map((project) => (
                      <ProjectCard
                        key={project.id}
                        project={project}
                        view={view}
                        category={category}
                        onClick={() => onSelectProject(project.id)}
                      />
                    ))}
                  </motion.div>
                </LayoutGroup>

                {/* Create button below content */}
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => !atLimit && onCreateProject(category)}
                    disabled={atLimit}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 text-sm rounded-xl transition-all cursor-none",
                      atLimit
                        ? "bg-[#111] border border-[#222] text-[#555] cursor-not-allowed"
                        : "bg-white text-black font-medium hover:bg-white/90"
                    )}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {atLimit ? `Limit reached (${count}/${limit})` : "New Project"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Project Card ── */

function ProjectCard({
  project,
  view,
  category,
  onClick,
}: {
  project: ProjectWithOwner;
  view: ViewMode;
  category: Category;
  onClick: () => void;
}) {
  const avatarSrc = project.owner_profile
    ? getAvatarUrl(project.owner_profile.avatar_style, project.owner_profile.avatar_seed)
    : undefined;

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
      {/* Avatar / icon block */}
      <motion.div
        layout
        transition={snappySpring}
        className={cn(
          "relative overflow-hidden shrink-0 bg-[#111] border border-[#222] flex items-center justify-center",
          view === "list" && "w-14 h-14 rounded-2xl",
          view === "card" && "w-full h-24 rounded-2xl"
        )}
      >
        {/* Background pattern — project initial */}
        <span
          className={cn(
            "font-display tracking-wider text-[#222] select-none",
            view === "list" && "text-2xl",
            view === "card" && "text-3xl"
          )}
        >
          {project.name.charAt(0).toUpperCase()}
        </span>

      </motion.div>

      {/* Info row */}
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

        {/* Type badge */}
        <motion.div
          layout
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-accent/5 text-accent text-[10px] font-bold shrink-0 ml-2 uppercase tracking-wider"
        >
          {category === "personal" ? (
            <User className="w-2.5 h-2.5" />
          ) : (
            <Users className="w-2.5 h-2.5" />
          )}
          <span>{category}</span>
        </motion.div>
      </motion.div>

      {/* List divider */}
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
