import { useState, useEffect } from "react";
import { getProfile } from "@/lib/profiles";

type Status = "active" | "away" | "offline";

const STATUS_COLORS: Record<Status, string> = {
  active: "#22c55e",
  away: "#eab308",
  offline: "#ef4444",
};

export function UserAvatar() {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("active");

  // Load avatar
  useEffect(() => {
    getProfile().then((profile) => {
      if (profile) {
        const url = `https://api.dicebear.com/9.x/${profile.avatar_style}/svg?seed=${encodeURIComponent(profile.avatar_seed)}`;
        setAvatarUrl(url);
      }
    });
  }, []);

  // Track active/away/offline
  useEffect(() => {
    const updateStatus = () => {
      if (!navigator.onLine) {
        setStatus("offline");
      } else if (document.visibilityState === "hidden") {
        setStatus("away");
      } else {
        setStatus("active");
      }
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

  if (!avatarUrl) return null;

  return (
    <div className="fixed top-5 right-6 z-[60] cursor-none">
      <div className="relative">
        <div
          className="w-10 h-10 rounded-full overflow-hidden bg-white border-2 transition-colors duration-300"
          style={{ borderColor: STATUS_COLORS[status] }}
        >
          <img src={avatarUrl} alt="You" className="w-full h-full" />
        </div>
        {/* Status dot */}
        <div
          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background transition-colors duration-300"
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
      </div>
    </div>
  );
}
