import { supabase } from "./supabase";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  type: "personal" | "team";
  owner_id: string;
  created_at: string;
}

export interface ProjectCollaborator {
  id: string;
  full_name: string;
  title?: string;
  affiliation?: string;
  avatar_style: string;
  avatar_seed: string;
  role: "Owner" | "Editor" | "Viewer";
}

export interface ProjectWithOwner extends Project {
  owner_profile: {
    full_name: string;
    avatar_style: string;
    avatar_seed: string;
  };
  my_role?: "Owner" | "Editor" | "Viewer";
  collaborators?: ProjectCollaborator[];
}

/** Team projects: 1 created per user, join unlimited others' */
export const PROJECT_LIMITS = { team_created: 1 } as const;

/* ── Team project counts ── */

export async function getTeamProjectCounts(): Promise<{
  ownedCount: number;
  memberOfCount: number;
}> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  try {
    const [ownedRes, totalRes] = await Promise.all([
      supabase.rpc("count_team_projects_owned", { uid: user.id }),
      supabase.rpc("count_team_projects", { uid: user.id }),
    ]);

    if (!ownedRes.error && !totalRes.error) {
      return {
        ownedCount: (ownedRes.data as number) ?? 0,
        memberOfCount: (totalRes.data as number) ?? 0,
      };
    }
  } catch {
    // RPC not available — fall through to client-side counting
  }

  // Fallback: count from fetched projects
  const { data } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("type", "team");

  const all = data ?? [];
  const owned = all.filter((p) => p.owner_id === user.id).length;
  return { ownedCount: owned, memberOfCount: all.length };
}

export async function canCreateTeamProject(): Promise<boolean> {
  const counts = await getTeamProjectCounts();
  return counts.ownedCount < PROJECT_LIMITS.team_created;
}

/* ── Team project creation ── */

export async function createProject(
  name: string,
  description: string,
): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const allowed = await canCreateTeamProject();
  if (!allowed) {
    throw new Error(
      `You've reached the limit of ${PROJECT_LIMITS.team_created} team project. You can still join others' projects.`
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, description, type: "team" as const, owner_id: user.id })
    .select()
    .single();

  if (error) throw error;

  // Auto-add owner as a member (status: accepted)
  await supabase.from("project_members").insert({
    project_id: data.id,
    user_id: user.id,
    email: user.email!,
    role: "Owner",
    status: "accepted",
  });

  return data;
}

/* ── Delete team project (owner only, cascading) ── */

export async function deleteTeamProject(projectId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get project info
  const { data: project } = await supabase
    .from("projects")
    .select("name, owner_id")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error("Project not found");
  if (project.owner_id !== user.id) throw new Error("Only the owner can delete a project");

  // Get all collaborators (not the owner) to notify them
  const { data: members } = await supabase
    .from("project_members")
    .select("user_id, email")
    .eq("project_id", projectId)
    .neq("user_id", user.id);

  // Get owner's name for notification
  const { data: ownerProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const ownerName = ownerProfile?.full_name ?? user.email ?? "The owner";

  // Delete old notifications for this project (invites, role changes etc.)
  await supabase.from("notifications").delete().eq("project_id", projectId);

  // Notify each collaborator about deletion (these survive because project_id becomes NULL on cascade)
  if (members && members.length > 0) {
    const notifications = members
      .filter((m) => m.user_id)
      .map((m) => ({
        user_id: m.user_id!,
        type: "removed" as const,
        project_id: projectId,
        project_name: project.name,
        from_user_id: user.id,
        from_user_name: ownerName,
        metadata: { reason: "project_deleted", message: `${ownerName} deleted the project "${project.name}"` },
      }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  }

  // Delete project — cascades to project_members, notifications.project_id set to NULL
  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) throw error;
}

/* ── Fetch team projects with owner info + user's role ── */

export async function getTeamProjects(): Promise<ProjectWithOwner[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Fetch all team projects visible to this user (RLS handles access)
  const { data, error } = await supabase
    .from("projects")
    .select("*, owner_profile:profiles!fk_projects_owner_profile(full_name, avatar_style, avatar_seed)")
    .eq("type", "team")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!data || data.length === 0) return [];

  // Fetch this user's roles for all these projects (only accepted memberships)
  const projectIds = data.map((p) => p.id);
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id, role, status")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .in("project_id", projectIds);

  const roleMap = new Map(
    (memberships ?? []).map((m) => [m.project_id, m.role as "Owner" | "Editor" | "Viewer"])
  );

  // Only show projects where user has accepted membership
  const acceptedProjectIds = new Set((memberships ?? []).map((m) => m.project_id));
  const visibleProjects = data.filter((p) =>
    p.owner_id === user.id || acceptedProjectIds.has(p.id)
  );

  // Fetch all accepted members for visible projects (for collaborator avatars)
  const visibleIds = visibleProjects.map((p) => p.id);
  const { data: allMembers } = await supabase
    .from("project_members")
    .select("project_id, user_id, role")
    .eq("status", "accepted")
    .in("project_id", visibleIds);

  // Fetch profiles for all unique member user_ids
  const allMemberUserIds = [...new Set((allMembers ?? []).filter((m) => m.user_id).map((m) => m.user_id!))];
  const { data: memberProfiles } = allMemberUserIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, title, affiliation, avatar_style, avatar_seed").in("id", allMemberUserIds)
    : { data: [] };

  const memberProfileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]));

  // Group collaborators by project
  const collaboratorsByProject = new Map<string, ProjectCollaborator[]>();
  for (const m of (allMembers ?? [])) {
    if (!m.user_id) continue;
    const profile = memberProfileMap.get(m.user_id);
    if (!profile) continue;
    const list = collaboratorsByProject.get(m.project_id) ?? [];
    list.push({
      id: m.user_id,
      full_name: profile.full_name,
      title: profile.title ?? undefined,
      affiliation: profile.affiliation ?? undefined,
      avatar_style: profile.avatar_style,
      avatar_seed: profile.avatar_seed,
      role: m.role as "Owner" | "Editor" | "Viewer",
    });
    collaboratorsByProject.set(m.project_id, list);
  }

  return (visibleProjects as unknown as ProjectWithOwner[]).map((p) => ({
    ...p,
    my_role: roleMap.get(p.id) ?? (p.owner_id === user.id ? "Owner" : undefined),
    collaborators: collaboratorsByProject.get(p.id) ?? [],
  }));
}
