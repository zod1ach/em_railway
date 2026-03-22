import { useState } from "react";
import { Plus, Check, ChevronsUpDown, Cable, Globe, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import type { FileCategory, CableSubType } from "@/types/project-files";

const spring = {
  type: "spring",
  damping: 30,
  stiffness: 400,
  mass: 1,
} as const;

type CategoryOption = {
  id: FileCategory;
  label: string;
  icon: typeof Cable;
};

const categories: CategoryOption[] = [
  { id: "cable", label: "Cable", icon: Cable },
  { id: "wmm", label: "WMM", icon: Globe },
  { id: "bathymetry", label: "Bathy", icon: Waves },
];

const cableSubTypes: { id: CableSubType; label: string }[] = [
  { id: "hvac", label: "HVAC" },
  { id: "dc_bipole", label: "DC Bipole" },
];

interface FileCreatorPillProps {
  onCreateFile: (category: FileCategory, subType?: CableSubType) => Promise<void>;
  disabled?: boolean;
  fileCount?: number;
  fileLimit?: number;
}

export function FileCreatorPill({
  onCreateFile,
  disabled = false,
  fileCount,
  fileLimit,
}: FileCreatorPillProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<FileCategory>("cable");
  const [subType, setSubType] = useState<CableSubType>("hvac");
  const [showSub, setShowSub] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleSelect = (cat: FileCategory) => {
    setSelected(cat);
    setShowSub(cat === "cable");
  };

  const handleConfirm = async () => {
    setCreating(true);
    try {
      await onCreateFile(selected, selected === "cable" ? subType : undefined);
      setIsOpen(false);
      setShowSub(false);
    } catch {
      // parent handles error
    } finally {
      setCreating(false);
    }
  };

  const atLimit = fileLimit !== undefined && fileCount !== undefined && fileCount >= fileLimit;

  return (
    <motion.div
      layout
      transition={spring}
      className={cn(
        "flex flex-col gap-1 shadow-lg overflow-hidden rounded-[20px] bg-[#161616] p-1",
        (disabled || atLimit) && "opacity-40 pointer-events-none"
      )}
    >
      {/* ── Main row ── */}
      <div className="flex items-center relative h-8">
        {/* Label — blurs out when open */}
        <motion.div
          layout
          animate={{ filter: isOpen ? "blur(8px)" : "blur(0px)" }}
          transition={spring}
          className="px-2.5 text-[#666] text-xs flex items-center gap-1.5 h-full whitespace-nowrap"
        >
          <Plus className="w-3 h-3" />
          New
        </motion.div>

        {isOpen ? (
          /* ── Expanded: category options + confirm ── */
          <div className="absolute inset-0 flex gap-1 p-0">
            <motion.div className="flex flex-1 relative items-center rounded-[16px]">
              <motion.div
                layout
                transition={spring}
                layoutId="fc-bg"
                className="absolute inset-0 rounded-[16px] bg-[#0d0d0d]"
              />
              <div className="flex px-0.5 relative z-10">
                {categories.map((cat) => (
                  <motion.button
                    key={cat.id}
                    layout
                    initial={{ filter: "blur(6px)", opacity: 0 }}
                    animate={{ filter: "blur(0px)", opacity: 1 }}
                    onClick={() => handleSelect(cat.id)}
                    data-magnetic
                    className={cn(
                      "relative px-2 py-1 rounded-[14px] text-[11px] flex items-center gap-1 cursor-none transition-colors duration-200",
                      selected === cat.id ? "text-white" : "text-[#666] hover:text-[#aaa]"
                    )}
                  >
                    {selected === cat.id && (
                      <motion.div
                        layoutId="fc-sel"
                        transition={spring}
                        className="absolute inset-0 bg-[#252525] rounded-[14px]"
                      />
                    )}
                    <cat.icon className="w-3 h-3 relative z-10" />
                    <span className="relative z-10">{cat.label}</span>
                  </motion.button>
                ))}
              </div>
            </motion.div>

            {/* Confirm button */}
            <AnimatePresence>
              <motion.button
                key="fc-confirm"
                layoutId="fc-btn"
                onClick={creating ? undefined : handleConfirm}
                initial={{ filter: "blur(2px)", opacity: 0.6 }}
                animate={{ filter: "blur(0px)", opacity: 1 }}
                exit={{ filter: "blur(2px)", opacity: 0.6 }}
                transition={spring}
                data-magnetic
                className="bg-[#CCFF00] w-8 shrink-0 flex items-center justify-center rounded-[14px] cursor-none"
              >
                {creating ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="w-3.5 h-3.5 border-[1.5px] border-black/20 border-t-black rounded-full"
                  />
                ) : (
                  <Check className="w-3.5 h-3.5 text-black" />
                )}
              </motion.button>
            </AnimatePresence>
          </div>
        ) : (
          /* ── Collapsed: just the + trigger ── */
          <motion.button
            onClick={() => setIsOpen(true)}
            data-magnetic
            className="absolute inset-0 flex items-center cursor-none"
          >
            <motion.div
              layout
              transition={spring}
              layoutId="fc-bg"
              className="absolute inset-0 rounded-[16px] bg-[#0d0d0d]"
            />
            <motion.div className="relative z-10 flex items-center w-full justify-between px-2.5">
              <span className="text-[11px] text-white font-medium">+</span>
              <motion.div layoutId="fc-btn">
                <ChevronsUpDown className="w-3 h-3 text-[#555] -rotate-90" />
              </motion.div>
            </motion.div>
          </motion.button>
        )}
      </div>

      {/* ── Sub-type row (Cable → HVAC / DC Bipole) ── */}
      <AnimatePresence mode="popLayout">
        {isOpen && showSub && selected === "cable" && (
          <motion.div
            initial={{ opacity: 0, y: -6, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(6px)" }}
            transition={spring}
            className="flex text-[#666] bg-[#0d0d0d] overflow-hidden rounded-[14px] p-0.5 gap-0.5"
          >
            {cableSubTypes.map((st, i) => (
              <motion.button
                key={st.id}
                layout
                initial={{ filter: "blur(6px)", opacity: 0 }}
                animate={{ filter: "blur(0px)", opacity: 1 }}
                exit={{ filter: "blur(6px)", opacity: 0 }}
                transition={{ ...spring, delay: i * 0.03 }}
                onClick={() => setSubType(st.id)}
                data-magnetic
                className={cn(
                  "relative px-3 py-1 rounded-[12px] text-[11px] cursor-none transition-colors duration-200",
                  subType === st.id ? "text-white" : "text-[#666] hover:text-[#aaa]"
                )}
              >
                <span className="relative z-10">{st.label}</span>
                {subType === st.id && (
                  <motion.div
                    layoutId="fc-sub"
                    transition={spring}
                    className="absolute inset-0 bg-[#252525] rounded-[12px]"
                  />
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── File count badge (team only) ── */}
      {fileLimit !== undefined && fileCount !== undefined && (
        <div className="px-2 pb-1 text-[10px] text-[#555]">
          <span className={cn(atLimit ? "text-red-400" : "text-[#888]")}>{fileCount}</span>
          /{fileLimit}
        </div>
      )}
    </motion.div>
  );
}
