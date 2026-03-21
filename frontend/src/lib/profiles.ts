import { supabase } from "./supabase";

export interface Profile {
  id: string;
  email: string | null;
  username: string | null;
  title: string | null;
  full_name: string;
  affiliation: string | null;
  avatar_style: string;
  avatar_seed: string;
  created_at: string;
}

export const TITLE_OPTIONS = [
  "Mr", "Mrs", "Ms", "Dr", "Prof", "Assoc. Prof",
] as const;

export function getAvatarUrl(style: string, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

export async function getProfile(): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("getProfile error:", error);
    return null;
  }
  return data;
}

export async function createProfile(profile: {
  title: string;
  full_name: string;
  affiliation: string;
  avatar_style: string;
  avatar_seed: string;
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .insert({ id: user.id, email: user.email, ...profile })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  if (!query || query.length < 2) return [];

  const { data: { user } } = await supabase.auth.getUser();

  const searchTerm = query.startsWith("@") ? query.slice(1) : query;
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .or(`email.ilike.%${searchTerm}%,full_name.ilike.%${searchTerm}%,username.ilike.%${searchTerm}%`)
    .neq("id", user?.id ?? "")
    .limit(5);

  if (error) {
    console.error("searchProfiles error:", error);
    return [];
  }
  return data ?? [];
}

export async function updateProfile(fields: {
  username?: string | null;
  title?: string | null;
  full_name?: string;
  affiliation?: string | null;
  avatar_style?: string;
  avatar_seed?: string;
}): Promise<Profile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Backfill email for profiles that were created before the email column existed
export async function backfillProfileEmail(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return;

  await supabase
    .from("profiles")
    .update({ email: user.email })
    .eq("id", user.id)
    .is("email", null);
}
