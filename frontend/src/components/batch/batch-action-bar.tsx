/**
 * Bottom action bar: Load to Flow — batch or individual.
 */

import { Play, Layers, FileText } from "lucide-react";
import { useState } from "react";

interface BatchActionBarProps {
  selectedCount: number;
  onLoadToFlow: (mode: "batch" | "individual") => void;
}

export function BatchActionBar({
  selectedCount,
  onLoadToFlow,
}: BatchActionBarProps) {
  const [showChoice, setShowChoice] = useState(false);
  const multi = selectedCount > 1;

  return (
    <div className="relative flex justify-end py-2">
      {/* Choice popover */}
      {showChoice && multi && (
        <div className="absolute bottom-full right-0 mb-1 flex gap-1 rounded-lg border border-[#222] bg-[#0d0d0d] p-1 shadow-xl">
          <button
            onClick={() => { setShowChoice(false); onLoadToFlow("batch"); }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/80 transition-colors hover:bg-[#CCFF00]/10 hover:text-[#CCFF00] cursor-none"
          >
            <Layers size={12} />
            Batch Node
          </button>
          <button
            onClick={() => { setShowChoice(false); onLoadToFlow("individual"); }}
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] uppercase tracking-wider text-white/80 transition-colors hover:bg-[#CCFF00]/10 hover:text-[#CCFF00] cursor-none"
          >
            <FileText size={12} />
            Individual
          </button>
        </div>
      )}

      <button
        onClick={() => {
          if (multi) {
            setShowChoice((p) => !p);
          } else {
            onLoadToFlow("individual");
          }
        }}
        disabled={selectedCount === 0}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all cursor-none
                   bg-[#CCFF00]/10 text-[#CCFF00] hover:bg-[#CCFF00]/20
                   disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <Play size={13} />
        Load to Flow ({selectedCount})
      </button>
    </div>
  );
}
