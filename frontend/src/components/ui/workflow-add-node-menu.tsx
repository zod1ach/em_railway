/**
 * Add-node dropdown menu — categorized by Source / Compute / Transform / Visualize / Output.
 */

import { useState } from "react";
import { Plus } from "lucide-react";
import * as Icons from "lucide-react";
import { NODE_PALETTE, getNodeDef } from "@/lib/workflow-node-registry";

/* ── Resolve icon by name ── */
function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string }>;
  }
  return Icons.CircleDot;
}

/* ── Category label colors ── */
const categoryColors: Record<string, string> = {
  source:    "text-rose-400",
  compute:   "text-emerald-400",
  transform: "text-amber-400",
  visualize: "text-violet-400",
  output:    "text-gray-400",
};

interface Props {
  onAddNode: (defType: string) => void;
}

export function WorkflowAddNodeMenu({ onAddNode }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="pointer-events-auto flex h-7 cursor-none items-center gap-1.5 rounded-md border border-[#222] bg-[#0d0d0d]/90 px-3 text-[10px] uppercase tracking-[0.2em] text-[#777] backdrop-blur-sm transition-colors hover:border-[#444] hover:text-white"
      >
        <Plus className="h-3 w-3" />
        Node
      </button>

      {open && (
        <>
          {/* Backdrop to close */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Menu */}
          <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-lg border border-[#222] bg-[#0d0d0d]/95 p-1.5 shadow-xl backdrop-blur-lg">
            {NODE_PALETTE.map((group) => (
              <div key={group.category} className="mb-1 last:mb-0">
                <div className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] ${categoryColors[group.category] ?? "text-[#555]"}`}>
                  {group.label}
                </div>
                {group.types.map((type) => {
                  const def = getNodeDef(type);
                  if (!def) return null;
                  const Icon = getIcon(def.iconName);
                  return (
                    <button
                      key={type}
                      onClick={() => {
                        onAddNode(type);
                        setOpen(false);
                      }}
                      className="flex w-full cursor-none items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-white/5"
                    >
                      <Icon className="h-3.5 w-3.5 text-[#888]" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[11px] text-white">{def.title}</div>
                        <div className="truncate text-[9px] text-[#555]">{def.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
