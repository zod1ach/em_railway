import { supabase } from "./supabase";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  type: "personal" | "team";
  owner_id: string;
  created_at: string;
}

export async function createProject(
  name: string,
  description: string,
  type: "personal" | "team"
): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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

export async function getUserProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
