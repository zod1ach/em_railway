import { useState, useEffect, useRef } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { createProject } from "@/lib/projects";
import { searchProfiles, getAvatarUrl, type Profile } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import { Loader2, X, Eye, Pencil, ChevronDown } from "lucide-react";

/* ── Role dropdown — styled like profile dropdown ── */
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

interface ProjectSetupFormProps {
  projectType: "personal" | "team";
  onCreated: (projectId: string) => void;
  onBack: () => void;
}

interface PendingMember {
  email: string;
  name?: string;
  affiliation?: string;
  avatarStyle?: string;
  avatarSeed?: string;
  role: "Viewer" | "Editor";
}

export function ProjectSetupForm({ projectType, onCreated, onBack }: ProjectSetupFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Team-only state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Viewer" | "Editor">("Viewer");
  const [pendingMembers, setPendingMembers] = useState<PendingMember[]>([]);

  const addMember = (member?: PendingMember) => {
    if (member) {
      if (pendingMembers.some((m) => m.email === member.email)) return;
      setPendingMembers([...pendingMembers, member]);
      setInviteEmail("");
      return;
    }
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) return;
    if (pendingMembers.some((m) => m.email === email)) return;
    setPendingMembers([...pendingMembers, { email, role: inviteRole }]);
    setInviteEmail("");
  };

  const removeMember = (email: string) => {
    setPendingMembers(pendingMembers.filter((m) => m.email !== email));
  };

  const updateMemberRole = (email: string, role: "Viewer" | "Editor") => {
    setPendingMembers(pendingMembers.map((m) => (m.email === email ? { ...m, role } : m)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const project = await createProject(name.trim(), description.trim(), projectType);

      if (projectType === "team" && pendingMembers.length > 0) {
        const memberInserts = pendingMembers.map((m) => ({
          project_id: project.id,
          email: m.email,
          role: m.role,
        }));
        await supabase.from("project_members").insert(memberInserts);
      }

      onCreated(project.id);
    } catch (err: any) {
      setError(err.message || "Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onBack} />

      <div className="relative z-10 w-full max-w-lg mx-4 animate-fade-in max-h-[85vh] overflow-y-auto">
        <div className="rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-8">
          <div className="mb-6">
            <h2 className="text-lg font-display tracking-[0.15em] text-white">
              {projectType === "personal" ? "PERSONAL PROJECT" : "TEAM PROJECT"}
            </h2>
            <p className="text-[#666] text-sm mt-1">
              {projectType === "personal" ? "Set up your workspace" : "Set up a shared workspace"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-[#888] block mb-1.5">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. North Sea Cable Study"
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="text-sm text-[#888] block mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of the project..."
                rows={2}
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors resize-none"
              />
            </div>

            {projectType === "team" && (
              <TeamInviteSection
                inviteEmail={inviteEmail}
                setInviteEmail={setInviteEmail}
                inviteRole={inviteRole}
                setInviteRole={setInviteRole}
                pendingMembers={pendingMembers}
                onAdd={addMember}
                onRemove={removeMember}
                onRoleChange={updateMemberRole}
              />
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Team invite sub-component ── */

interface TeamInviteSectionProps {
  inviteEmail: string;
  setInviteEmail: (v: string) => void;
  inviteRole: "Viewer" | "Editor";
  setInviteRole: (v: "Viewer" | "Editor") => void;
  pendingMembers: PendingMember[];
  onAdd: (member?: PendingMember) => void;
  onRemove: (email: string) => void;
  onRoleChange: (email: string, role: "Viewer" | "Editor") => void;
}

function TeamInviteSection({
  inviteEmail, setInviteEmail, inviteRole, setInviteRole,
  pendingMembers, onAdd, onRemove, onRoleChange,
}: TeamInviteSectionProps) {
  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (inviteEmail.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const results = await searchProfiles(inviteEmail);
      // Filter out already-added members
      const filtered = results.filter(
        (p) => !pendingMembers.some((m) => m.email === p.email)
      );
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inviteEmail, pendingMembers]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const selectSuggestion = (profile: Profile) => {
    onAdd({
      email: profile.email!,
      name: profile.full_name,
      affiliation: profile.affiliation ?? undefined,
      avatarStyle: profile.avatar_style,
      avatarSeed: profile.avatar_seed,
      role: inviteRole,
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm text-[#888] block">Invite Members</label>

      {/* Invite row with search dropdown */}
      <div ref={wrapperRef} className="relative">
        <div className="flex gap-2">
          <input
            type="text"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAdd(); } }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            placeholder="@username or email"
            className="flex-1 min-w-0 bg-[#111] border border-[#333] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
          />

          <RoleDropdown value={inviteRole} onChange={setInviteRole} size="md" />

          <button
            type="button"
            onClick={() => onAdd()}
            className="px-4 py-2 bg-white text-black text-sm font-medium rounded-lg hover:bg-white/90 transition-colors shrink-0"
          >
            Invite
          </button>
        </div>

        {/* Search suggestions dropdown */}
        {showSuggestions && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#151515] border border-[#333] rounded-lg overflow-hidden z-20 shadow-xl">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectSuggestion(p)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#222] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full overflow-hidden bg-white shrink-0">
                  <img
                    src={getAvatarUrl(p.avatar_style, p.avatar_seed)}
                    alt={p.full_name}
                    className="w-full h-full"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">
                    {p.title ? `${p.title} ` : ""}{p.full_name}
                  </p>
                  <div className="flex items-center gap-1.5">
                    {p.username && (
                      <span className="text-[11px] text-[#888] truncate">@{p.username}</span>
                    )}
                    {p.username && p.email && <span className="text-[10px] text-[#444]">&middot;</span>}
                    <span className="text-[11px] text-[#666] truncate">{p.email}</span>
                  </div>
                  {p.affiliation && (
                    <p className="text-[10px] text-[#555] truncate">{p.affiliation}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pending members list */}
      {pendingMembers.length > 0 && (
        <ul className="space-y-2">
          {pendingMembers.map((m) => (
            <li key={m.email} className="flex items-center justify-between bg-[#111] border border-[#222] rounded-lg px-3 py-2">
              <div className="flex items-center gap-2.5">
                {m.avatarStyle ? (
                  <div className="w-7 h-7 rounded-full overflow-hidden bg-white shrink-0">
                    <img src={getAvatarUrl(m.avatarStyle, m.avatarSeed!)} alt="" className="w-full h-full" />
                  </div>
                ) : (
                  <div className="w-7 h-7 rounded-full bg-[#222] flex items-center justify-center text-[10px] text-[#888] font-medium uppercase shrink-0">
                    {m.email[0]}
                  </div>
                )}
                <div className="min-w-0">
                  {m.name ? (
                    <>
                      <p className="text-sm text-[#ccc] truncate">{m.name}</p>
                      <p className="text-[10px] text-[#555] truncate">{m.email}</p>
                    </>
                  ) : (
                    <span className="text-sm text-[#ccc] truncate">{m.email}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <RoleDropdown value={m.role} onChange={(r) => onRoleChange(m.email, r)} />
                <button
                  type="button"
                  onClick={() => onRemove(m.email)}
                  className="text-[#555] hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
