import { useState, useEffect } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { User, Bell, LogOut } from "lucide-react";
import { getProfile, getAvatarUrl, type Profile } from "@/lib/profiles";

type Status = "active" | "away" | "offline";

const STATUS_COLORS: Record<Status, string> = {
  active: "#22c55e",
  away: "#eab308",
  offline: "#ef4444",
};

interface ProfileDropdownProps {
  onSignOut: () => void;
  onEditProfile: () => void;
  onNotifications: () => void;
}

export function ProfileDropdown({ onSignOut, onEditProfile, onNotifications }: ProfileDropdownProps) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("active");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getProfile().then(setProfile);
  }, []);

  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) setStatus("offline");
      else if (document.visibilityState === "hidden") setStatus("away");
      else setStatus("active");
    };
    updateStatus();
    document.addEventListener("visibilitychange", updateStatus);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      document.removeEventListener("visibilitychange", updateStatus);
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (!profile) return null;

  const avatarSrc = getAvatarUrl(profile.avatar_style, profile.avatar_seed);
  const displayName = profile.username || profile.full_name;

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button className="fixed top-4 right-6 z-[60] rounded-full border border-[#222] bg-[#0d0d0d]/90 backdrop-blur-xl p-1 hover:border-[#444] transition-colors cursor-none outline-none">
          <div className="relative">
            <div
              className="w-9 h-9 rounded-full overflow-hidden bg-white border-2 transition-colors duration-300"
              style={{ borderColor: STATUS_COLORS[status] }}
            >
              <img src={avatarSrc} alt={displayName} className="w-full h-full" />
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d0d0d] transition-colors duration-300"
              style={{ backgroundColor: STATUS_COLORS[status] }}
            />
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-[70] w-64 rounded-xl border border-[#222] bg-[#0d0d0d]/95 backdrop-blur-xl p-1.5 shadow-2xl animate-fade-in"
        >
          {/* User info header */}
          <div className="px-3 py-3 flex items-center gap-3 border-b border-[#1a1a1a] mb-1">
            <div className="w-10 h-10 rounded-full overflow-hidden bg-white flex-shrink-0">
              <img src={avatarSrc} alt={displayName} className="w-full h-full" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{profile.full_name}</p>
              {profile.username && (
                <p className="text-[11px] text-[#666] truncate">@{profile.username}</p>
              )}
              <p className="text-[11px] text-[#555] truncate">{profile.email}</p>
            </div>
          </div>

          <DropdownMenu.Item
            onSelect={onEditProfile}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#ccc] hover:bg-[#1a1a1a] hover:text-white transition-colors outline-none cursor-none"
          >
            <User className="w-4 h-4 text-[#666]" />
            Edit Profile
          </DropdownMenu.Item>

          <DropdownMenu.Item
            onSelect={onNotifications}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-[#ccc] hover:bg-[#1a1a1a] hover:text-white transition-colors outline-none cursor-none"
          >
            <Bell className="w-4 h-4 text-[#666]" />
            Notifications
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="h-px bg-[#1a1a1a] my-1" />

          <DropdownMenu.Item
            onSelect={onSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors outline-none cursor-none"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
