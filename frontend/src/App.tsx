import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getProfile, backfillProfileEmail } from "@/lib/profiles";
import { getTeamProjects, getTeamProjectCounts, type ProjectWithOwner } from "@/lib/projects";
import { getLocalProjects, createLocalProject, type LocalProject } from "@/lib/local-db";
import { cleanupExpiredInvites } from "@/lib/notifications";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { HvacNonMagnetic } from "@/components/tabs/HvacNonMagnetic";
import { HvacMagnetic } from "@/components/tabs/HvacMagnetic";
import { DCBipole } from "@/components/tabs/DCBipole";
import { WMMGeomag } from "@/components/tabs/WMMGeomag";
import { Cable3D } from "@/components/tabs/Cable3D";
import LaunchButton from "@/components/ui/button-with-icon";
import { MagneticCursor } from "@/components/ui/magnetic-cursor";
import { CreateProjectModal } from "@/components/ui/create-project-modal";
import { ProjectSetupForm } from "@/components/ui/project-setup-form";
import { ProjectsCollection } from "@/components/ui/projects-collection";
import { OnboardingForm } from "@/components/ui/onboarding-form";
import { ProfileDropdown } from "@/components/ui/profile-dropdown";
import { EditProfileModal } from "@/components/ui/edit-profile-modal";
import { ModeSelector, type AppMode } from "@/components/ui/mode-selector";
import { NotificationsPanel } from "@/components/ui/notifications-panel";
import { OfflineApp } from "@/components/OfflineApp";
import { ProjectWorkspace } from "@/components/ui/project-workspace";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import type { Session } from "@supabase/supabase-js";

type AppView = "onboarding" | "landing" | "projects" | "pick-type" | "setup-form" | "create-local" | "dashboard" | "workspace";

/* ── Persist mode choice in localStorage ── */
const STORAGE_KEY_MODE = "electrofish_app_mode";

function getSavedMode(): AppMode | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_MODE);
    if (saved === "offline" || saved === "team") return saved;
  } catch { /* private browsing etc */ }
  return null;
}

function saveMode(mode: AppMode) {
  try { localStorage.setItem(STORAGE_KEY_MODE, mode); } catch { /* ignore */ }
}

export function clearSavedMode() {
  try { localStorage.removeItem(STORAGE_KEY_MODE); } catch { /* ignore */ }
}

export default function App() {
  const [appMode, setAppMode] = useState<AppMode | null>(getSavedMode);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>("landing");
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [newLocalName, setNewLocalName] = useState("");
  const [newLocalDesc, setNewLocalDesc] = useState("");
  const [creatingLocal, setCreatingLocal] = useState(false);
  const [teamProjects, setTeamProjects] = useState<ProjectWithOwner[]>([]);
  const [localProjects, setLocalProjects] = useState<LocalProject[]>([]);
  const [teamOwnedCount, setTeamOwnedCount] = useState(0);
  const [authError, setAuthError] = useState("");
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectType, setActiveProjectType] = useState<"local" | "team">("local");
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeFileName, setActiveFileName] = useState<string | null>(null);

  // Handle mode selection (offline goes straight through)
  const handleModeSelect = (mode: AppMode) => {
    saveMode(mode);
    setAppMode(mode);
    if (mode === "offline") {
      setLoading(false);
    }
  };

  // Switch back to mode selection
  const handleSwitchMode = () => {
    clearSavedMode();
    setAppMode(null);
    setSession(null);
    setView("landing");
    setTeamProjects([]);
    setLocalProjects([]);
    setTeamOwnedCount(0);
    setAuthError("");
  };

  // Auth handlers — passed to ModeSelector for inline login
  const handleSignIn = async (email: string, password: string) => {
    setAuthError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setAuthError(error.message);
      return;
    }
    // onAuthStateChange will fire and set session + appMode
  };

  const handleCreateAccount = async (email: string, password: string) => {
    setAuthError("");
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  const handleResetPassword = async (email: string) => {
    setAuthError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset`,
    });
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Check if user has any projects (local + team) and route accordingly
  const loadProjectsAndRoute = async () => {
    try {
      // Clean up expired invites (7-day TTL)
      cleanupExpiredInvites().catch(() => {});

      const [team, local] = await Promise.all([
        getTeamProjects(),
        getLocalProjects(),
      ]);
      setTeamProjects(team);
      setLocalProjects(local);
      if (team.length > 0 || local.length > 0) {
        const counts = await getTeamProjectCounts();
        setTeamOwnedCount(counts.ownedCount);
        setView("projects");
      } else {
        setView("landing");
      }
    } catch (e) {
      console.error("Projects check failed:", e);
      setView("landing");
    }
  };

  // Auth: getSession() for initial load, onAuthStateChange for subsequent events.
  // Web Lock deadlock is fixed in supabase.ts — safe with React StrictMode.
  useEffect(() => {
    if (appMode === "team") {
      supabase.auth.getSession().then(async ({ data }) => {
        setSession(data.session);
        if (data.session) {
          try {
            const profile = await getProfile();
            if (!profile) {
              setView("onboarding");
            } else {
              backfillProfileEmail();
              await loadProjectsAndRoute();
            }
          } catch (e) {
            console.error("Profile check failed:", e);
          }
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Listen for sign-in / sign-out / token refresh (NOT async to avoid lock re-entry)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);

      if (event === "SIGNED_IN") {
        saveMode("team");
        setAppMode("team");
        // Load profile/projects outside the lock scope
        setTimeout(async () => {
          try {
            const profile = await getProfile();
            if (!profile) {
              setView("onboarding");
            } else {
              await loadProjectsAndRoute();
            }
          } catch (e) {
            console.error("Profile check failed:", e);
          }
          setLoading(false);
        }, 0);
      } else if (event === "SIGNED_OUT") {
        setView("landing");
        setTeamProjects([]);
        setLocalProjects([]);
        setTeamOwnedCount(0);
      }
    });

    return () => subscription.unsubscribe();
  }, [appMode]);

  /* ── Mode selection + inline login ── */
  if (appMode === null) {
    return (
      <MagneticCursor
        magneticFactor={0.55}
        blendMode="exclusion"
        cursorSize={6}
        cursorColor="white"
        contrastBoost={1.5}
      >
        <ModeSelector
          onSelect={handleModeSelect}
          onSignIn={handleSignIn}
          onCreateAccount={handleCreateAccount}
          onResetPassword={handleResetPassword}
          authError={authError}
          clearAuthError={() => setAuthError("")}
        />
      </MagneticCursor>
    );
  }

  /* ── Offline mode: personal projects via IndexedDB ── */
  if (appMode === "offline") {
    return <OfflineApp onSwitchMode={handleSwitchMode} />;
  }

  /* ── Team mode: waiting for auth ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  // If team mode but no session after loading finished, show mode selector
  if (!session) {
    return (
      <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
        <ModeSelector
          onSelect={handleModeSelect}
          onSignIn={handleSignIn}
          onCreateAccount={handleCreateAccount}
          onResetPassword={handleResetPassword}
          authError={authError}
          clearAuthError={() => setAuthError("")}
        />
      </MagneticCursor>
    );
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    handleSwitchMode();
  };

  // Persistent UI on all post-login screens
  const profileDropdown = (
    <ProfileDropdown
      key={view}
      onSignOut={handleSignOut}
      onEditProfile={() => setEditProfileOpen(true)}
      onNotifications={() => setNotificationsOpen(true)}
    />
  );
  const notificationsPanel = (
    <NotificationsPanel
      open={notificationsOpen}
      onClose={() => setNotificationsOpen(false)}
      onActionComplete={loadProjectsAndRoute}
    />
  );
  const editModal = (
    <EditProfileModal open={editProfileOpen} onClose={() => setEditProfileOpen(false)} />
  );

  // Onboarding for new users
  if (view === "onboarding") {
    return (
      <>
        {profileDropdown}
        {editModal}
        {notificationsPanel}
        <OnboardingForm
          email={session.user.email ?? ""}
          onComplete={() => setView("landing")}
        />
      </>
    );
  }

  // Projects listing page (user has at least one project)
  if (view === "projects") {
    return (
      <>
        {profileDropdown}
        {editModal}
        {notificationsPanel}
        <MagneticCursor
          magneticFactor={0.55}
          blendMode="exclusion"
          cursorSize={6}
          cursorColor="white"
          contrastBoost={1.5}
        >
          <div className="h-[100dvh] w-[100dvw] relative overflow-y-auto cursor-none bg-background">
            <ProjectsCollection
              teamProjects={teamProjects}
              localProjects={localProjects}
              ownedCount={teamOwnedCount}
              onSelectProject={(projectId, projectType, projectName) => {
                setActiveProjectId(projectId);
                setActiveProjectType(projectType);
                setActiveProjectName(projectName);
                setView("workspace");
              }}
              onCreateTeamProject={() => setView("setup-form")}
              onCreateLocalProject={() => setView("create-local")}
              onLocalProjectsChange={async () => {
                const updated = await getLocalProjects();
                setLocalProjects(updated);
              }}
            />
          </div>
        </MagneticCursor>
      </>
    );
  }

  // Workspace
  if (view === "workspace" && activeProjectId && activeProjectName) {
    return (
      <MagneticCursor magneticFactor={0.55} blendMode="exclusion" cursorSize={6} cursorColor="white" contrastBoost={1.5}>
        {profileDropdown}
        {editModal}
        <ProjectWorkspace
          projectId={activeProjectId}
          projectName={activeProjectName}
          projectType={activeProjectType}
          onGoToProjects={() => {
            setActiveProjectId(null);
            setActiveProjectName(null);
            setView("projects");
          }}
          onSelectFile={(fileId, fileName) => {
            setActiveFileId(fileId);
            setActiveFileName(fileName);
            setView("dashboard");
          }}
        />
      </MagneticCursor>
    );
  }

  // Pre-dashboard views: landing → pick type → setup form
  if (view !== "dashboard") {
    const hasProjects = teamProjects.length > 0 || localProjects.length > 0;

    return (
      <>
      {profileDropdown}
      {editModal}
      <MagneticCursor
        magneticFactor={0.55}
        blendMode="exclusion"
        cursorSize={6}
        cursorColor="white"
        contrastBoost={1.5}
      >
        <div className="h-[100dvh] w-[100dvw] relative overflow-hidden flex items-center justify-center cursor-none bg-background">
          {/* Landing: just the create button (only when no projects) */}
          {view === "landing" && (
            <div className="relative z-10 animate-fade-in">
              <LaunchButton
                label="Create a project!"
                onClick={() => setView("pick-type")}
              />
            </div>
          )}

          {/* Pick type modal */}
          <CreateProjectModal
            open={view === "pick-type"}
            onClose={() => setView(hasProjects ? "projects" : "landing")}
            onSelect={() => setView("setup-form")}
            ownedCount={teamOwnedCount}
          />

          {/* Create local project form */}
          {view === "create-local" && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setView("projects")} />
              <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in">
                <div className="rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-8">
                  <div className="mb-6">
                    <h2 className="text-lg font-display tracking-[0.15em] text-white">PERSONAL PROJECT</h2>
                    <p className="text-[#666] text-sm mt-1">Stored locally on this machine</p>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="text-sm text-[#888] block mb-1.5">Project Name</label>
                      <input
                        type="text"
                        value={newLocalName}
                        onChange={(e) => setNewLocalName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newLocalName.trim()) {
                            setCreatingLocal(true);
                            createLocalProject(newLocalName.trim(), newLocalDesc.trim()).then(() => {
                              setNewLocalName(""); setNewLocalDesc(""); setCreatingLocal(false);
                              loadProjectsAndRoute();
                            });
                          }
                        }}
                        placeholder="e.g. North Sea Cable Study"
                        className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[#888] block mb-1.5">Description</label>
                      <textarea
                        value={newLocalDesc}
                        onChange={(e) => setNewLocalDesc(e.target.value)}
                        placeholder="Brief description..."
                        rows={2}
                        className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors resize-none"
                      />
                    </div>
                    <button
                      onClick={() => {
                        if (!newLocalName.trim()) return;
                        setCreatingLocal(true);
                        createLocalProject(newLocalName.trim(), newLocalDesc.trim()).then(() => {
                          setNewLocalName(""); setNewLocalDesc(""); setCreatingLocal(false);
                          loadProjectsAndRoute();
                        });
                      }}
                      disabled={creatingLocal || !newLocalName.trim()}
                      className="w-full h-12 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-none"
                    >
                      {creatingLocal ? "Creating..." : "Create Project"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Setup form */}
          {view === "setup-form" && (
            <ProjectSetupForm
              onBack={() => setView("pick-type")}
              onCreated={async (projectId) => {
                console.log("Project created:", projectId);
                await loadProjectsAndRoute();
              }}
            />
          )}
        </div>
      </MagneticCursor>
      </>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden bg-background">
      {profileDropdown}
      {editModal}
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="w-full px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display text-[22px] tracking-[0.2em] text-foreground">ELECTROFISH</span>
            <div className="w-px h-6 bg-border-accent" />
            {activeProjectName ? (
              <Breadcrumbs
                items={[
                  { label: "Projects", onClick: () => { setActiveFileId(null); setActiveFileName(null); setActiveProjectId(null); setView("projects"); } },
                  { label: activeProjectName, onClick: () => { setActiveFileId(null); setActiveFileName(null); setView("workspace"); } },
                  { label: activeFileName ?? "Dashboard" },
                ]}
              />
            ) : (
              <span className="font-mono text-[11px] text-muted">v2.0</span>
            )}
          </div>
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
        <span className="font-mono text-[11px] text-muted">2026</span>
      </footer>
    </div>
  );
}
