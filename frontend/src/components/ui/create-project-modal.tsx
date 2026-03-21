import { User, Users } from "lucide-react";
import { PROJECT_LIMITS } from "@/lib/projects";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: "personal" | "team") => void;
  personalCount?: number;
  teamCount?: number;
}

export function CreateProjectModal({ open, onClose, onSelect, personalCount = 0, teamCount = 0 }: CreateProjectModalProps) {
  if (!open) return null;

  const personalAtLimit = personalCount >= PROJECT_LIMITS.personal;
  const teamAtLimit = teamCount >= PROJECT_LIMITS.team;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal — no visible container, just floating cards */}
      <div className="relative z-10 w-full max-w-3xl mx-4 animate-fade-in">
        <div className="px-4">
          <h2 className="text-lg font-display tracking-[0.15em] text-white mb-1 text-center">
            CREATE PROJECT
          </h2>
          <p className="text-[#666] text-sm mb-8 text-center">Choose your workspace type</p>

          {/* Two horizontal cards — wide gap, no container border */}
          <div className="grid grid-cols-2 gap-10">
            {/* Personal */}
            <div
              data-magnetic
              data-magnetic-static
              onClick={() => !personalAtLimit && onSelect("personal")}
              className={`group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl px-7 shadow-2xl transition-transform ${
                personalAtLimit
                  ? "bg-white/40 text-black/50 cursor-not-allowed"
                  : "bg-white text-black hover:scale-[1.02] cursor-pointer"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                  Solo workspace
                </span>
                <span className="text-lg font-bold tracking-tight">
                  Personal
                </span>
                {personalAtLimit && (
                  <span className="text-[10px] text-red-500 font-medium">Limit reached</span>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${personalAtLimit ? "bg-black/30" : "bg-black"} text-white`}>
                  <User className="h-4 w-4 pointer-events-none" />
                </div>
                <span className={`text-[10px] font-bold ${personalAtLimit ? "text-red-500" : "text-black/40"}`}>
                  {personalCount}/{PROJECT_LIMITS.personal}
                </span>
              </div>
            </div>

            {/* Team */}
            <div
              data-magnetic
              data-magnetic-static
              onClick={() => !teamAtLimit && onSelect("team")}
              className={`group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl px-7 shadow-2xl transition-transform ${
                teamAtLimit
                  ? "bg-white/40 text-black/50 cursor-not-allowed"
                  : "bg-white text-black hover:scale-[1.02] cursor-pointer"
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                  Collaborate
                </span>
                <span className="text-lg font-bold tracking-tight">
                  Team
                </span>
                {teamAtLimit && (
                  <span className="text-[10px] text-red-500 font-medium">Limit reached</span>
                )}
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${teamAtLimit ? "bg-black/30" : "bg-black"} text-white`}>
                  <Users className="h-4 w-4 pointer-events-none" />
                </div>
                <span className={`text-[10px] font-bold ${teamAtLimit ? "text-red-500" : "text-black/40"}`}>
                  {teamCount}/{PROJECT_LIMITS.team}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
