import { useState, useEffect } from "react";
import { Loader2, ChevronDown, Check } from "lucide-react";
import {
  getProfile,
  updateProfile,
  getAvatarUrl,
  TITLE_OPTIONS,
  type Profile,
} from "@/lib/profiles";

const AVATAR_STYLES = ["notionists", "shapes"] as const;
type AvatarStyle = (typeof AVATAR_STYLES)[number];

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [title, setTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>("notionists");
  const [avatarSeed, setAvatarSeed] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError("");
    setSuccess(false);
    getProfile().then((p) => {
      if (!p) return;
      setProfile(p);
      setUsername(p.username ?? "");
      setTitle(p.title ?? "");
      setFullName(p.full_name);
      setAffiliation(p.affiliation ?? "");
      setAvatarStyle((p.avatar_style as AvatarStyle) || "notionists");
      setAvatarSeed(p.avatar_seed);
    });
  }, [open]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateProfile({
        username: username.trim() || null,
        title: title || null,
        full_name: fullName.trim(),
        affiliation: affiliation.trim() || null,
        avatar_style: avatarStyle,
        avatar_seed: avatarSeed,
      });
      setSuccess(true);
      setTimeout(() => onClose(), 800);
    } catch (err: any) {
      const msg = err.message || "Failed to save";
      if (msg.includes("profiles_username_unique")) {
        setError("Username is already taken");
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const seeds = profile
    ? [
        profile.email ?? "default",
        (profile.email ?? "a") + "a",
        (profile.email ?? "b") + "b",
        (profile.email ?? "c") + "c",
        (profile.email ?? "x") + "x",
        (profile.email ?? "z") + "z",
        "ocean", "cable", "wave", "fish", "spark", "volt",
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-8 animate-fade-in max-h-[90vh] overflow-y-auto">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-display tracking-[0.15em] text-white">
            EDIT PROFILE
          </h2>
          <p className="text-[#666] text-sm mt-1">Update your information</p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Avatar picker */}
          <AvatarPicker
            style={avatarStyle}
            seed={avatarSeed}
            seeds={seeds}
            onStyleChange={setAvatarStyle}
            onSeedChange={setAvatarSeed}
          />

          {/* Username */}
          <div>
            <label className="text-sm text-[#888] block mb-1.5">Username</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#555]">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.-]/g, ""))}
                placeholder="username"
                maxLength={30}
                className="w-full bg-[#111] border border-[#333] rounded-xl pl-8 pr-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
              />
            </div>
            <p className="text-[10px] text-[#555] mt-1">Lowercase letters, numbers, dots, dashes, underscores</p>
          </div>

          {/* Title + Full Name */}
          <div className="flex gap-3">
            <div className="w-28">
              <label className="text-sm text-[#888] block mb-1.5">Title</label>
              <div className="relative">
                <select
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="appearance-none w-full bg-[#111] border border-[#333] rounded-xl px-3 py-3 pr-7 text-sm text-white focus:outline-none focus:border-[#666] transition-colors cursor-pointer"
                >
                  <option value="">—</option>
                  {TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-[#666] pointer-events-none" />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-sm text-[#888] block mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. James Maxwell"
                className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
              />
            </div>
          </div>

          {/* Affiliation */}
          <div>
            <label className="text-sm text-[#888] block mb-1.5">Affiliation</label>
            <input
              type="text"
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value)}
              placeholder="e.g. University of Southampton"
              className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-[#666] transition-colors"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="text-sm text-[#888] block mb-1.5">Email</label>
            <input
              type="email"
              value={profile?.email ?? ""}
              disabled
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-[#666] cursor-not-allowed"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={saving || success}
            className={`w-full h-12 rounded-xl font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
              success
                ? "bg-green-500 text-white"
                : "bg-white text-black hover:bg-white/90"
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : success ? (
              <>
                <Check className="w-4 h-4" />
                Saved
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ── Avatar picker (reused pattern from onboarding) ── */

interface AvatarPickerProps {
  style: AvatarStyle;
  seed: string;
  seeds: string[];
  onStyleChange: (s: AvatarStyle) => void;
  onSeedChange: (s: string) => void;
}

function AvatarPicker({ style, seed, seeds, onStyleChange, onSeedChange }: AvatarPickerProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#333] hover:border-[#666] transition-colors bg-white"
      >
        <img src={getAvatarUrl(style, seed)} alt="Avatar" className="w-full h-full" />
      </button>
      <span className="text-[11px] text-[#555]">Click to change avatar</span>

      {expanded && (
        <div className="w-full bg-[#111] border border-[#222] rounded-xl p-4 space-y-4 animate-fade-in">
          <div>
            <span className="text-[10px] text-[#555] uppercase tracking-wider block mb-2">Style</span>
            <div className="flex gap-3 justify-center">
              {AVATAR_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onStyleChange(s)}
                  className={`px-4 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                    style === s
                      ? "bg-white text-black"
                      : "bg-[#1a1a1a] text-[#888] border border-[#333] hover:border-[#555]"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-6 gap-3 justify-items-center">
            {seeds.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => { onSeedChange(s); setExpanded(false); }}
                className={`w-12 h-12 rounded-full overflow-hidden border-2 transition-colors bg-white ${
                  seed === s ? "border-white" : "border-[#333] hover:border-[#555]"
                }`}
              >
                <img src={getAvatarUrl(style, s)} alt={s} className="w-full h-full" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
