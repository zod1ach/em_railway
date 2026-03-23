/**
 * Bottom action bar: Load to Flow button.
 */

import { Play } from "lucide-react";

interface BatchActionBarProps {
  selectedCount: number;
  onLoadToFlow: () => void;
}

export function BatchActionBar({
  selectedCount,
  onLoadToFlow,
}: BatchActionBarProps) {
  return (
    <div className="flex justify-end py-2">
      <button
        onClick={onLoadToFlow}
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
