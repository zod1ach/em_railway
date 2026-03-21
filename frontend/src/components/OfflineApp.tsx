import { useState, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { HvacNonMagnetic } from "@/components/tabs/HvacNonMagnetic";
import { HvacMagnetic } from "@/components/tabs/HvacMagnetic";
import { DCBipole } from "@/components/tabs/DCBipole";
import { WMMGeomag } from "@/components/tabs/WMMGeomag";
import { Cable3D } from "@/components/tabs/Cable3D";
import LaunchButton from "@/components/ui/button-with-icon";
import { MagneticCursor } from "@/components/ui/magnetic-cursor";
import { Plus, Users, LayoutList, LayoutGrid, Trash2, Download } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import {
  createLocalProject,
  getLocalProjects,
  deleteLocalProject,
  downloadProject,
  type LocalProject,
} from "@/lib/local-db";

type OfflineView = "landing" | "projects" | "create" | "dashboard";

interface OfflineAppProps {
  onSwitchMode: () => void;
}

export function OfflineApp({ onSwitchMode }: OfflineAppProps) {
  const [view, setView] = useState<OfflineView>("landing");
  const [localProjects, setLocalProjects] = useState<LocalProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [listView, setListView] = useState<"list" | "card">("list");

  // Create form state
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    const projects = await getLocalProjects();
    setLocalProjects(projects);
    if (projects.length > 0) {
      setView("projects");
    } else {
      setView("landing");
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await createLocalProject(newName.trim(), newDesc.trim());
      setNewName("");
      setNewDesc("");
      await loadProjects();
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteLocalProject(id);
    await loadProjects();
  };

  const handleExport = async (id: string) => {
    await downloadProject(id);
  };

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
    setView("dashboard");
  };

  const activeProject = localProjects.find((p) => p.id === activeProjectId);

  /* ── Landing: no projects yet ── */
  if (view === "landing") {
    return (
      <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
        <div className="h-[100dvh] w-[100dvw] relative overflow-hidden flex items-center justify-center cursor-none bg-background">
          <div className="relative z-10 animate-fade-in flex flex-col items-center gap-6">
            <LaunchButton
              label="Create a project!"
              onClick={() => setView("create")}
            />
            <button
              onClick={onSwitchMode}
              className="text-[13px] text-[#666] hover:text-white hover:font-bold transition-all cursor-none"
            >
              Switch to team mode →
            </button>
          </div>
        </div>
      </MagneticCursor>
    );
  }

  /* ── Create project form ── */
  if (view === "create") {
    return (
      <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
        <div className="h-[100dvh] w-[100dvw] relative overflow-hidden flex items-center justify-center cursor-none bg-background">
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setView(localProjects.length > 0 ? "projects" : "landing")}
            />
            <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in">
              <div className="rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-8">
                <div className="mb-6">
                  <h2 className="text-lg font-display tracking-[0.15em] text-white">
                    PERSONAL PROJECT
                  </h2>
                  <p className="text-[#666] text-sm mt-1">Stored locally in your browser</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="text-sm text-[#888] block mb-1.5">Project Name</label>
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
                      placeholder="e.g. North Sea Cable Study"
                      className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="text-sm text-[#888] block mb-1.5">Description</label>
                    <textarea
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Brief description..."
                      rows={2}
                      className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors resize-none"
                    />
                  </div>

                  <button
                    onClick={handleCreate}
                    disabled={creating || !newName.trim()}
                    className="w-full h-12 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-none"
                  >
                    {creating ? "Creating..." : "Create Project"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MagneticCursor>
    );
  }

  /* ── Projects list ── */
  if (view === "projects") {
    return (
      <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
        <div className="h-[100dvh] w-[100dvw] relative overflow-y-auto cursor-none bg-background">
          <div className="w-full p-6 md:p-10">
            <div className="flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-display tracking-[0.15em] text-white">
                  MY PROJECTS
                </h2>
                <div className="flex items-center gap-3">
                  {/* View toggle */}
                  <div className="flex p-1 bg-[#111] rounded-full border border-[#222]">
                    <button
                      onClick={() => setListView("list")}
                      className={cn(
                        "relative w-8 h-8 flex items-center justify-center rounded-full transition-all outline-none cursor-none",
                        listView === "list" ? "text-black bg-white" : "text-[#666] hover:text-white"
                      )}
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setListView("card")}
                      className={cn(
                        "relative w-8 h-8 flex items-center justify-center rounded-full transition-all outline-none cursor-none",
                        listView === "card" ? "text-black bg-white" : "text-[#666] hover:text-white"
                      )}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Create button */}
                  <button
                    onClick={() => setView("create")}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors cursor-none"
                    title="New project"
                  >
                    <Plus className="w-4 h-4" />
                  </button>

                  {/* Switch to team mode — same size as plus button */}
                  <button
                    onClick={onSwitchMode}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-[#111] border border-[#333] text-[#666] hover:text-white hover:border-[#555] transition-colors cursor-none"
                    title="Switch to team mode"
                  >
                    <Users className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="h-px bg-[#222] w-full" />

              {/* Project grid — always 3 columns */}
              <div className="w-full grid grid-cols-3 gap-4">
                <AnimatePresence>
                  {localProjects.map((project) => (
                    <motion.div
                      key={project.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => handleSelectProject(project.id)}
                      className={cn(
                        "group relative flex cursor-none",
                        listView === "list" ? "flex-row items-center gap-4 w-full" : "flex-col gap-3 w-full items-start"
                      )}
                    >
                      {/* Initial block */}
                      <div className={cn(
                        "relative overflow-hidden shrink-0 bg-[#111] border border-[#222] flex items-center justify-center",
                        listView === "list" ? "w-14 h-14 rounded-2xl" : "w-full h-24 rounded-2xl"
                      )}>
                        <span className={cn(
                          "font-display tracking-wider text-[#222] select-none",
                          listView === "list" ? "text-2xl" : "text-3xl"
                        )}>
                          {project.name.charAt(0).toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className={cn(
                        "flex flex-1 justify-between items-center min-w-0",
                        listView === "card" ? "w-full px-1" : "px-0"
                      )}>
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <h3 className="font-medium text-[15px] text-white leading-tight truncate group-hover:text-accent transition-colors">
                            {project.name}
                          </h3>
                          <span className="text-[10px] text-[#555]">
                            {new Date(project.updated_at).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleExport(project.id); }}
                            className="p-1.5 rounded-lg hover:bg-[#222] text-[#666] hover:text-white transition-colors cursor-none"
                            title="Download"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(project.id); }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#666] hover:text-red-400 transition-colors cursor-none"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* List divider */}
                      {listView === "list" && (
                        <div className="absolute -bottom-1.5 left-[4.5rem] right-0 h-px bg-[#1a1a1a]" />
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

            </div>
          </div>
        </div>
      </MagneticCursor>
    );
  }

  /* ── Dashboard ── */
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="w-full px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView("projects")}
              className="font-display text-[22px] tracking-[0.2em] text-foreground hover:text-accent transition-colors"
            >
              ELECTROFISH
            </button>
            <div className="w-px h-6 bg-border-accent" />
            {activeProject && (
              <span className="text-sm text-muted truncate max-w-[200px]">
                {activeProject.name}
              </span>
            )}
          </div>
          <button
            onClick={() => setView("projects")}
            className="text-xs text-muted hover:text-foreground transition-colors"
          >
            ← Back to projects
          </button>
        </div>
      </header>

      {/* Main */}
      <Tabs defaultValue="hvac-nonmag">
        <div className="relative z-10 border-b border-border px-12 bg-surface/60 backdrop-blur-sm">
          <TabsList>
            <TabsTrigger value="hvac-nonmag">HVAC NON-MAGNETIC</TabsTrigger>
            <TabsTrigger value="hvac-mag">HVAC MAGNETIC ARMOUR</TabsTrigger>
            <TabsTrigger value="dc-bipole">DC BIPOLE</TabsTrigger>
            <TabsTrigger value="wmm">WMM GEOMAGNETIC</TabsTrigger>
            <TabsTrigger value="cable-3d">CABLE 3D ROUTE</TabsTrigger>
          </TabsList>
        </div>

        <main className="flex-1 w-full px-12 py-10 relative z-10">
          <TabsContent value="hvac-nonmag"><HvacNonMagnetic /></TabsContent>
          <TabsContent value="hvac-mag"><HvacMagnetic /></TabsContent>
          <TabsContent value="dc-bipole"><DCBipole /></TabsContent>
          <TabsContent value="wmm"><WMMGeomag /></TabsContent>
          <TabsContent value="cable-3d"><Cable3D /></TabsContent>
        </main>
      </Tabs>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-surface/80 backdrop-blur-sm h-10 flex items-center justify-between px-12">
        <span className="text-[11px] text-muted">University of Southampton — EPE Research Group</span>
        <span className="font-mono text-[11px] text-muted">OFFLINE MODE</span>
      </footer>
    </div>
  );
}
