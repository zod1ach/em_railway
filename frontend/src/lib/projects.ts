import { supabase } from "./supabase";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  type: "personal" | "team";
  owner_id: string;
  created_at: string;
}

export interface ProjectWithOwner extends Project {
  owner_profile: {
    full_name: string;
    avatar_style: string;
    avatar_seed: string;
  };
}

export const PROJECT_LIMITS = { personal: 2, team: 2 } as const;

/* ── Limit checks ── */

export async function getProjectCounts(): Promise<{
  personalCount: number;
  teamCount: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  try {
    // Try server-side RPC functions first (requires migration 000500)
    const [personalRes, teamRes] = await Promise.all([
      supabase.rpc("count_personal_projects", { uid: user.id }),
      supabase.rpc("count_team_projects", { uid: user.id }),
    ]);

    if (!personalRes.error && !teamRes.error) {
      return {
        personalCount: (personalRes.data as number) ?? 0,
        teamCount: (teamRes.data as number) ?? 0,
      };
    }
  } catch {
    // RPC not available yet — fall through to client-side counting
  }

  // Fallback: count from fetched projects
  const { data } = await supabase.from("projects").select("type").order("created_at");
  const all = data ?? [];
  return {
    personalCount: all.filter((p) => p.type === "personal").length,
    teamCount: all.filter((p) => p.type === "team").length,
  };
}

export async function canCreateProject(type: "personal" | "team"): Promise<boolean> {
  const counts = await getProjectCounts();
  if (type === "personal") return counts.personalCount < PROJECT_LIMITS.personal;
  return counts.teamCount < PROJECT_LIMITS.team;
}

/* ── Project creation (with pre-check) ── */

export async function createProject(
  name: string,
  description: string,
  type: "personal" | "team"
): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Frontend limit check (RLS is the safety net once migration is applied)
  const allowed = await canCreateProject(type);
  if (!allowed) {
    const label = type === "personal" ? "personal projects" : "team spaces";
    throw new Error(`You've reached the limit of ${PROJECT_LIMITS[type]} ${label}`);
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, type, owner_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // Auto-add owner as a member
  await supabase.from("project_members").insert({
    project_id: data.id,
    user_id: user.id,
    email: user.email!,
    role: "Owner",
  });

  return data;
}

/* ── Fetch projects grouped by type with owner info ── */

export async function getUserProjectsGrouped(): Promise<{
  personal: ProjectWithOwner[];
  team: ProjectWithOwner[];
}> {
  // Try join query first (requires FK from migration 000500)
  const { data, error } = await supabase
    .from("projects")
    .select("*, owner_profile:profiles!fk_projects_owner_profile(full_name, avatar_style, avatar_seed)")
    .order("created_at", { ascending: false });

  if (!error && data) {
    const all = data as unknown as ProjectWithOwner[];
    return {
      personal: all.filter((p) => p.type === "personal"),
      team: all.filter((p) => p.type === "team"),
    };
  }

  // Fallback: fetch projects without join, then batch-fetch owner profiles
  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (projErr) throw projErr;
  if (!projects || projects.length === 0) return { personal: [], team: [] };

  const ownerIds = [...new Set(projects.map((p) => p.owner_id))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_style, avatar_seed")
    .in("id", ownerIds);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.id, { full_name: p.full_name, avatar_style: p.avatar_style, avatar_seed: p.avatar_seed }])
  );

  const all: ProjectWithOwner[] = projects.map((p) => ({
    ...p,
    owner_profile: profileMap.get(p.owner_id) ?? { full_name: "Unknown", avatar_style: "notionists", avatar_seed: "default" },
  }));

  return {
    personal: all.filter((p) => p.type === "personal"),
    team: all.filter((p) => p.type === "team"),
  };
}
