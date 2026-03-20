import { User, Users } from "lucide-react";

interface CreateProjectModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (type: "personal" | "team") => void;
}

export function CreateProjectModal({ open, onClose, onSelect }: CreateProjectModalProps) {
  if (!open) return null;

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
              onClick={() => onSelect("personal")}
              className="group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl bg-white px-7 text-black shadow-2xl transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                  Solo workspace
                </span>
                <span className="text-lg font-bold tracking-tight">
                  Personal
                </span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                <User className="h-4 w-4 pointer-events-none" />
              </div>
            </div>

            {/* Team */}
            <div
              data-magnetic
              data-magnetic-static
              onClick={() => onSelect("team")}
              className="group relative flex h-24 w-full items-center justify-between overflow-hidden rounded-2xl bg-white px-7 text-black shadow-2xl transition-transform hover:scale-[1.02] cursor-pointer"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-[10px] font-medium uppercase tracking-widest opacity-50">
                  Collaborate
                </span>
                <span className="text-lg font-bold tracking-tight">
                  Team
                </span>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white">
                <Users className="h-4 w-4 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
