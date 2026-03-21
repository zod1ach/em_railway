import { useState, useEffect, useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { searchProfiles, getAvatarUrl, type Profile } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import { updateLocalProject, type LocalProject } from "@/lib/local-db";
import { createNotification } from "@/lib/notifications";
import { Loader2, X, Eye, Pencil, ChevronDown, Trash2 } from "lucide-react";

/* ── Role dropdown (reused from project-setup-form) ── */

function RoleDropdown({ value, onChange, size = "sm" }: {
  value: "Viewer" | "Editor";
  onChange: (v: "Viewer" | "Editor") => void;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-6 text-[10px] gap-1 px-2" : "h-9 text-xs gap-1.5 px-2.5";
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`flex items-center justify-center rounded-full border transition-colors w-[72px] shrink-0 ${h} ${
            value === "Editor"
              ? "border-white/20 bg-white/10 text-white"
              : "border-[#333] bg-[#1a1a1a] text-[#888]"
          } hover:border-[#555] outline-none cursor-none`}
        >
          {value === "Viewer" ? <Eye className="w-3 h-3 shrink-0" /> : <Pencil className="w-3 h-3 shrink-0" />}
          {value === "Viewer" ? "View" : "Edit"}
          <ChevronDown className="w-2.5 h-2.5 text-[#666] shrink-0" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[70] w-44 rounded-xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-1.5 shadow-2xl animate-fade-in"
        >
          <DropdownMenu.Item
            onSelect={() => onChange("Viewer")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors outline-none cursor-none ${
              value === "Viewer" ? "text-white bg-[#1a1a1a]" : "text-[#ccc] hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            <Eye className="w-4 h-4 text-[#666]" />
            Can View
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => onChange("Editor")}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors outline-none cursor-none ${
              value === "Editor" ? "text-white bg-[#1a1a1a]" : "text-[#ccc] hover:bg-[#1a1a1a] hover:text-white"
            }`}
          >
            <Pencil className="w-4 h-4 text-[#666]" />
            Can Edit
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

/* ── Types ── */

interface ExistingMember {
  id: string;
  user_id: string | null;
  email: string;
  role: "Owner" | "Editor" | "Viewer";
  profile?: {
    full_name: string;
    avatar_style: string;
    avatar_seed: string;
    username?: string;
  };
}

interface ProjectSettingsModalProps {
  open: boolean;
  onClose: () => void;
  /** "local" = personal project (name/desc only), "team" = name/desc + members */
  mode: "local" | "team";
  /** For local projects */
  localProject?: LocalProject;
  /** For team projects */
  teamProjectId?: string;
  teamProjectName?: string;
  teamProjectDescription?: string | null;
  /** Called after save */
  onSaved: () => void;
}

export function ProjectSettingsModal({
  open,
  onClose,
  mode,
  localProject,
  teamProjectId,
  teamProjectName,
  teamProjectDescription,
  onSaved,
}: ProjectSettingsModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Team members
  const [members, setMembers] = useState<ExistingMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Viewer" | "Editor">("Viewer");
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Initialize form values
  useEffect(() => {
    if (!open) return;
    if (mode === "local" && localProject) {
      setName(localProject.name);
      setDescription(localProject.description ?? "");
    } else if (mode === "team") {
      setName(teamProjectName ?? "");
      setDescription(teamProjectDescription ?? "");
      loadMembers();
    }
    setError("");
  }, [open, mode, localProject, teamProjectId]);

  const loadMembers = async () => {
    if (!teamProjectId) return;
    setLoadingMembers(true);
    try {
      const { data } = await supabase
        .from("project_members")
        .select("id, user_id, email, role, status")
        .eq("project_id", teamProjectId)
        .neq("status", "declined");

      if (data) {
        // Fetch profiles for members with user_id
        const userIds = data.filter((m) => m.user_id).map((m) => m.user_id!);
        const { data: profiles } = userIds.length > 0
          ? await supabase.from("profiles").select("id, full_name, avatar_style, avatar_seed, username").in("id", userIds)
          : { data: [] };

        const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

        setMembers(data.map((m) => ({
          ...m,
          role: m.role as "Owner" | "Editor" | "Viewer",
          profile: m.user_id ? profileMap.get(m.user_id) ?? undefined : undefined,
        })));
      }
    } finally {
      setLoadingMembers(false);
    }
  };

  // Debounced search for invite
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inviteEmail.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }

    debounceRef.current = setTimeout(async () => {
      const results = await searchProfiles(inviteEmail);
      const existingEmails = members.map((m) => m.email);
      const filtered = results.filter((p) => !existingEmails.includes(p.email!));
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inviteEmail, members]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleSave = async () => {
    if (!name.trim()) { setError("Project name is required"); return; }
    setSaving(true);
    setError("");

    try {
      if (mode === "local" && localProject) {
        await updateLocalProject(localProject.id, { name: name.trim(), description: description.trim() || null });
      } else if (mode === "team" && teamProjectId) {
        await supabase.from("projects").update({ name: name.trim(), description: description.trim() || null }).eq("id", teamProjectId);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Helper: get current user info for notifications
  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    return { id: user.id, name: profile?.full_name ?? user.email ?? "Someone" };
  };

  // Team member management — with notifications
  const addMemberByEmail = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@") || !teamProjectId) return;
    if (members.some((m) => m.email === email)) return;

    // Remove any previous declined/removed membership for re-invite
    await supabase.from("project_members")
      .delete()
      .eq("project_id", teamProjectId)
      .eq("email", email)
      .in("status", ["declined"]);

    const { data, error: err } = await supabase.from("project_members").insert({
      project_id: teamProjectId,
      email,
      role: inviteRole,
      status: "pending",
    }).select().single();

    if (err) { setError(err.message); return; }

    // Try to find the user by email to send notification
    const { data: invitee } = await supabase.from("profiles").select("id").eq("email", email).single();
    if (invitee) {
      const me = await getCurrentUser();
      await createNotification({
        userId: invitee.id,
        type: "invite",
        projectId: teamProjectId,
        projectName: name,
        fromUserId: me?.id,
        fromUserName: me?.name,
        metadata: { role: inviteRole },
      });
    }

    setMembers([...members, { ...data, role: data.role as "Owner" | "Editor" | "Viewer" }]);
    setInviteEmail("");
  };

  const addMemberFromSuggestion = async (profile: Profile) => {
    if (!teamProjectId) return;

    // Remove any previous declined membership for re-invite
    await supabase.from("project_members")
      .delete()
      .eq("project_id", teamProjectId)
      .eq("email", profile.email!)
      .in("status", ["declined"]);

    const { data, error: err } = await supabase.from("project_members").insert({
      project_id: teamProjectId,
      user_id: profile.id,
      email: profile.email!,
      role: inviteRole,
      status: "pending",
    }).select().single();

    if (err) { setError(err.message); return; }

    // Send invite notification
    const me = await getCurrentUser();
    await createNotification({
      userId: profile.id,
      type: "invite",
      projectId: teamProjectId,
      projectName: name,
      fromUserId: me?.id,
      fromUserName: me?.name,
      metadata: { role: inviteRole },
    });

    setMembers([...members, {
      ...data,
      role: data.role as "Owner" | "Editor" | "Viewer",
      profile: { full_name: profile.full_name, avatar_style: profile.avatar_style, avatar_seed: profile.avatar_seed, username: profile.username ?? undefined },
    }]);
    setInviteEmail("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const updateMemberRole = async (memberId: string, role: "Viewer" | "Editor") => {
    const member = members.find((m) => m.id === memberId);
    await supabase.from("project_members").update({ role }).eq("id", memberId);
    setMembers(members.map((m) => m.id === memberId ? { ...m, role } : m));

    // Notify the member about role change
    if (member?.user_id) {
      const me = await getCurrentUser();
      await createNotification({
        userId: member.user_id,
        type: "role_changed",
        projectId: teamProjectId!,
        projectName: name,
        fromUserId: me?.id,
        fromUserName: me?.name,
        metadata: { new_role: role === "Editor" ? "Can Edit" : "Can View" },
      });
    }
  };

  const removeMember = async (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    await supabase.from("project_members").delete().eq("id", memberId);
    setMembers(members.filter((m) => m.id !== memberId));

    // Notify the removed member
    if (member?.user_id) {
      const me = await getCurrentUser();
      await createNotification({
        userId: member.user_id,
        type: "removed",
        projectId: teamProjectId!,
        projectName: name,
        fromUserId: me?.id,
        fromUserName: me?.name,
      });
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto">
        <div className="rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-8">
          <div className="mb-6">
            <h2 className="text-lg font-display tracking-[0.15em] text-white">
              PROJECT SETTINGS
            </h2>
            <p className="text-[#666] text-sm mt-1">
              {mode === "local" ? "Edit your personal project" : "Manage project and team"}
            </p>
          </div>

          <div className="space-y-5">
            {/* Name */}
            <div>
              <label className="text-sm text-[#888] block mb-1.5">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
                autoFocus
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-sm text-[#888] block mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description..."
                rows={2}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors resize-none"
              />
            </div>

            {/* Team members section */}
            {mode === "team" && (
              <div className="space-y-3">
                <label className="text-sm text-[#888] block">Team Members</label>

                {/* Invite row */}
                <div ref={wrapperRef} className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMemberByEmail(); } }}
                      onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                      placeholder="@username or email"
                      className="flex-1 min-w-0 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
                    />
                    <RoleDropdown value={inviteRole} onChange={setInviteRole} size="md" />
                    <button
                      type="button"
                      onClick={addMemberByEmail}
                      className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors shrink-0 cursor-none"
                    >
                      Add
                    </button>
                  </div>

                  {/* Search suggestions */}
                  {showSuggestions && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-[#151515] border border-[#333] rounded-lg overflow-hidden z-20 shadow-xl">
                      {suggestions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => addMemberFromSuggestion(p)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#222] transition-colors text-left cursor-none"
                        >
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-white shrink-0">
                            <img src={getAvatarUrl(p.avatar_style, p.avatar_seed)} alt={p.full_name} className="w-full h-full" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-white truncate">{p.title ? `${p.title} ` : ""}{p.full_name}</p>
                            <div className="flex items-center gap-1.5">
                              {p.username && <span className="text-[11px] text-[#888] truncate">@{p.username}</span>}
                              {p.username && p.email && <span className="text-[10px] text-[#444]">&middot;</span>}
                              <span className="text-[11px] text-[#666] truncate">{p.email}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Existing members list */}
                {loadingMembers ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-4 h-4 animate-spin text-[#666]" />
                  </div>
                ) : members.length > 0 ? (
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li key={m.id} className="flex items-center justify-between bg-[#111] border border-[#222] rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2.5">
                          {m.profile ? (
                            <div className="w-7 h-7 rounded-full overflow-hidden bg-white shrink-0">
                              <img src={getAvatarUrl(m.profile.avatar_style, m.profile.avatar_seed)} alt="" className="w-full h-full" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-[10px] text-[#888] font-medium uppercase shrink-0">
                              {m.email[0]}
                            </div>
                          )}
                          <div className="min-w-0">
                            {m.profile ? (
                              <>
                                <p className="text-sm text-[#ccc] truncate">{m.profile.full_name}</p>
                                <p className="text-[10px] text-[#555] truncate">{m.email}</p>
                              </>
                            ) : (
                              <span className="text-sm text-[#ccc] truncate">{m.email}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {m.role === "Owner" ? (
                            <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider px-2">Owner</span>
                          ) : (
                            <>
                              <RoleDropdown value={m.role as "Viewer" | "Editor"} onChange={(r) => updateMemberRole(m.id, r)} />
                              <button
                                type="button"
                                onClick={() => removeMember(m.id)}
                                className="text-[#555] hover:text-red-400 transition-colors cursor-none"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-none"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
