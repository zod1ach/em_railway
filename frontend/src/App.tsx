import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getProfile, backfillProfileEmail } from "@/lib/profiles";
import { Login } from "@/pages/Login";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { HvacNonMagnetic } from "@/components/tabs/HvacNonMagnetic";
import { HvacMagnetic } from "@/components/tabs/HvacMagnetic";
import { DCBipole } from "@/components/tabs/DCBipole";
import { WMMGeomag } from "@/components/tabs/WMMGeomag";
import { Cable3D } from "@/components/tabs/Cable3D";
import { LogOut } from "lucide-react";
import LaunchButton from "@/components/ui/button-with-icon";
import { MagneticCursor } from "@/components/ui/magnetic-cursor";
import { CreateProjectModal } from "@/components/ui/create-project-modal";
import { ProjectSetupForm } from "@/components/ui/project-setup-form";
import { OnboardingForm } from "@/components/ui/onboarding-form";
import { UserAvatar } from "@/components/ui/user-avatar";
import type { Session } from "@supabase/supabase-js";

type AppView = "onboarding" | "landing" | "pick-type" | "setup-form" | "dashboard";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AppView>("landing");
  const [projectType, setProjectType] = useState<"personal" | "team">("personal");

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        try {
          const profile = await getProfile();
          if (!profile) setView("onboarding");
          else backfillProfileEmail();
        } catch (e) {
          console.error("Profile check failed:", e);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (!session) {
        setView("landing");
      } else if (_event === "SIGNED_IN") {
        try {
          const profile = await getProfile();
          if (!profile) setView("onboarding");
        } catch (e) {
          console.error("Profile check failed:", e);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <span className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Login onLogin={() => {}} />;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  // Persistent UI on all post-login screens
  const avatar = <UserAvatar key={view} />;
  const logoutBtn = (
    <button
      onClick={handleSignOut}
      className="fixed top-7 left-7 z-[60] text-red-500 hover:text-red-400 transition-colors cursor-none"
    >
      <LogOut className="w-5 h-5 stroke-[2.5]" />
    </button>
  );

  // Onboarding for new users
  if (view === "onboarding") {
    return (
      <>
        {avatar}
        {logoutBtn}
        <OnboardingForm
          email={session.user.email ?? ""}
          onComplete={() => setView("landing")}
        />
      </>
    );
  }

  // Pre-dashboard views: landing → pick type → setup form
  if (view !== "dashboard") {
    return (
      <>
      {avatar}
      {logoutBtn}
      <MagneticCursor
        magneticFactor={0.55}
        blendMode="exclusion"
        cursorSize={6}
        cursorColor="white"
        contrastBoost={1.5}
      >
        <div className="h-[100dvh] w-[100dvw] relative overflow-hidden flex items-center justify-center cursor-none bg-background">
          {/* Landing: just the create button */}
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
            onClose={() => setView("landing")}
            onSelect={(type) => {
              setProjectType(type);
              setView("setup-form");
            }}
          />

          {/* Setup form */}
          {view === "setup-form" && (
            <ProjectSetupForm
              projectType={projectType}
              onBack={() => setView("pick-type")}
              onCreated={(projectId) => {
                console.log("Project created:", projectId);
                setView("dashboard");
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
      {avatar}
      {logoutBtn}
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-md border-b border-border">
        <div className="w-full px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-display text-[22px] tracking-[0.2em] text-foreground">ELECTROFISH</span>
            <div className="w-px h-6 bg-border-accent" />
            <span className="font-mono text-[11px] text-muted">v2.0</span>
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
