import { Users } from "lucide-react";
import { PROJECT_LIMITS } from "@/lib/projects";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: () => void;
  ownedCount?: number;
}

export function CreateProjectModal({ open, onClose, onSelect, ownedCount = 0 }: CreateProjectModalProps) {
  if (!open) return null;

  const atLimit = ownedCount >= PROJECT_LIMITS.team_created;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-fade-in">
        <div className="px-4">
          <h2 className="text-lg font-display tracking-[0.15em] text-white mb-1 text-center">
            CREATE TEAM PROJECT
          </h2>
          <p className="text-[#666] text-sm mb-8 text-center">
            Start a collaborative workspace
          </p>

          {/* Single team card */}
          <div
            onClick={() => !atLimit && onSelect()}
            className={`group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl px-7 shadow-2xl transition-transform ${
              atLimit
                ? "bg-white/40 text-black/50 cursor-not-allowed"
                : "bg-white text-black hover:scale-[1.02] cursor-pointer"
            }`}
          >
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                Collaborate
              </span>
              <span className="text-lg font-bold tracking-tight">
                Team Project
              </span>
              {atLimit ? (
                <span className="text-[10px] text-red-500 font-medium">
                  Limit reached — join others' projects instead
                </span>
              ) : (
                <span className="text-[10px] text-black/40 font-medium">
                  Create 1, join unlimited
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${atLimit ? "bg-black/30" : "bg-black"} text-white`}>
                <Users className="h-4 w-4 pointer-events-none" />
              </div>
              <span className={`text-[10px] font-bold ${atLimit ? "text-red-500" : "text-black/40"}`}>
                {ownedCount}/{PROJECT_LIMITS.team_created}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
