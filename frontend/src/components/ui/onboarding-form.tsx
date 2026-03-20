import { useState } from "react";
import { createProfile, TITLE_OPTIONS } from "@/lib/profiles";
import { Loader2, ChevronDown } from "lucide-react";

const AVATAR_STYLES = ["notionists", "shapes"] as const;
type AvatarStyle = typeof AVATAR_STYLES[number];

function avatarUrl(style: AvatarStyle, seed: string): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
}

interface OnboardingFormProps {
  email: string;
  onComplete: () => void;
}

export function OnboardingForm({ email, onComplete }: OnboardingFormProps) {
  const [title, setTitle] = useState("");
  const [fullName, setFullName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyle>("notionists");
  const [avatarSeed, setAvatarSeed] = useState(email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createProfile({
        title,
        full_name: fullName.trim(),
        affiliation: affiliation.trim(),
        avatar_style: avatarStyle,
        avatar_seed: avatarSeed,
      });
      onComplete();
    } catch (err: any) {
      setError(err.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[100dvh] w-[100dvw] flex items-center justify-center bg-background">
      <div className="w-full max-w-lg mx-4 animate-fade-in">
        <div className="rounded-2xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-8">
          <div className="mb-6 text-center">
            <h2 className="text-2xl font-display tracking-[0.15em] text-white">
              WELCOME ABOARD
            </h2>
            <p className="text-[#666] text-sm mt-1">Tell us about yourself</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AvatarPicker
              style={avatarStyle}
              seed={avatarSeed}
              email={email}
              onStyleChange={setAvatarStyle}
              onSeedChange={setAvatarSeed}
            />

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
                  autoFocus
                />
              </div>
            </div>

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

            <div>
              <label className="text-sm text-[#888] block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-sm text-[#666] cursor-not-allowed"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Get Started"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

/* ── Notionists avatar picker ── */

interface AvatarPickerProps {
  style: AvatarStyle;
  seed: string;
  email: string;
  onStyleChange: (s: AvatarStyle) => void;
  onSeedChange: (s: string) => void;
}

function AvatarPicker({ style, seed, email, onStyleChange, onSeedChange }: AvatarPickerProps) {
  const [expanded, setExpanded] = useState(false);

  const seeds = [
    email,
    email + "a", email + "b", email + "c",
    email + "x", email + "z",
    "ocean", "cable", "wave", "fish",
    "spark", "volt",
  ];

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-20 h-20 rounded-full overflow-hidden border-2 border-[#333] hover:border-[#666] transition-colors bg-white"
      >
        <img src={avatarUrl(style, seed)} alt="Avatar" className="w-full h-full" />
      </button>
      <span className="text-[11px] text-[#555]">Click to change avatar</span>

      {expanded && (
        <div className="w-full bg-[#111] border border-[#222] rounded-xl p-4 space-y-4 animate-fade-in">
          {/* Style toggle */}
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

          {/* Seed grid */}
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
                <img src={avatarUrl(style, s)} alt={s} className="w-full h-full" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
