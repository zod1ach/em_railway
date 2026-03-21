import { useState } from "react";
import { Plus, Check, ChevronsUpDown, Cable, Globe, Waves } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "motion/react";
import type { FileCategory, CableSubType } from "@/types/project-files";

const springTransition = {
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
  { id: "cable", label: "Cable Model", icon: Cable },
  { id: "wmm", label: "WMM Geomagnetic", icon: Globe },
  { id: "bathymetry", label: "Bathymetry", icon: Waves },
];

type SubTypeOption = {
  id: CableSubType;
  label: string;
};

const cableSubTypes: SubTypeOption[] = [
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
  const [selectedCategory, setSelectedCategory] = useState<FileCategory>("cable");
  const [selectedSubType, setSelectedSubType] = useState<CableSubType>("hvac");
  const [showSubType, setShowSubType] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleCategorySelect = (category: FileCategory) => {
    setSelectedCategory(category);
    if (category === "cable") {
      setShowSubType(true);
    } else {
      setShowSubType(false);
    }
  };

  const handleConfirm = async () => {
    setCreating(true);
    try {
      if (selectedCategory === "cable") {
        await onCreateFile(selectedCategory, selectedSubType);
      } else {
        await onCreateFile(selectedCategory);
      }
      setIsOpen(false);
      setShowSubType(false);
    } catch {
      // Error handled by parent (toast)
    } finally {
      setCreating(false);
    }
  };

  const atLimit = fileLimit !== undefined && fileCount !== undefined && fileCount >= fileLimit;

  return (
    <div className="flex items-center gap-3">
      <motion.div
        layout
        transition={springTransition}
        className={cn(
          "flex flex-col gap-1.5 overflow-hidden rounded-3xl bg-[#1c1c1c] p-1.5",
          disabled || atLimit ? "opacity-40 pointer-events-none" : ""
        )}
      >
        <div className="flex justify-between items-center relative">
          <motion.div
            layout
            animate={{
              filter: isOpen ? "blur(8px)" : "blur(0px)",
            }}
            transition={springTransition}
            className="px-3 text-[#888] h-full flex items-center justify-center py-2"
          >
            New File
          </motion.div>

          {isOpen ? (
            <div className="absolute w-full h-full flex justify-between gap-2 p-0">
              <motion.div className="flex justify-between w-full relative items-center rounded-3xl">
                <motion.div
                  layout
                  transition={springTransition}
                  layoutId="pill-options-bg"
                  className="absolute w-full rounded-3xl bg-[#0d0d0d] h-full"
                />
                <div className="flex justify-between px-1">
                  {categories.map((cat) => (
                    <motion.div
                      key={cat.id}
                      layout
                      initial={{ filter: "blur(8px)", opacity: 0 }}
                      animate={{ filter: "blur(0px)", opacity: 1 }}
                      onClick={() => handleCategorySelect(cat.id)}
                      className={cn(
                        "px-2.5 py-1 rounded-3xl relative transition-colors duration-300 cursor-none flex items-center gap-1.5",
                        selectedCategory === cat.id ? "text-white" : "text-[#888]"
                      )}
                      data-magnetic
                    >
                      {selectedCategory === cat.id && (
                        <motion.div
                          layoutId="pill-active-option"
                          transition={springTransition}
                          className="w-full h-full absolute inset-0 bg-[#222] rounded-3xl"
                        />
                      )}
                      <cat.icon className="w-3.5 h-3.5 relative z-10" />
                      <span className="relative z-10 text-xs whitespace-nowrap">{cat.label}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              <AnimatePresence>
                <motion.div
                  key="confirm-btn"
                  layoutId="pill-action-btn"
                  onClick={creating ? undefined : handleConfirm}
                  initial={{ filter: "blur(1px)", opacity: 0.6 }}
                  animate={{ filter: "blur(0px)", opacity: 1 }}
                  exit={{ filter: "blur(1px)", opacity: 0.6 }}
                  transition={springTransition}
                  style={{ borderRadius: 24 }}
                  className="bg-[#CCFF00] px-[10px] justify-center text-black flex h-full items-center cursor-none"
                  data-magnetic
                >
                  {creating ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                    />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          ) : (
            <motion.div
              onClick={disabled || atLimit ? undefined : () => setIsOpen(true)}
              className="rounded-full w-fit px-0 p-0 relative flex gap-0 items-center cursor-none"
              data-magnetic
            >
              <motion.div
                layout
                transition={springTransition}
                layoutId="pill-options-bg"
                className="absolute h-full w-full bg-[#0d0d0d] rounded-3xl"
              />
              <motion.div
                initial={false}
                className="pl-3 py-0 relative text-white flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
              </motion.div>
              <AnimatePresence initial={false}>
                <motion.div
                  key="expand-icon"
                  layoutId="pill-action-btn"
                  className="text-[#888] justify-center flex items-center w-fit h-fit px-3 pl-2 py-[10px]"
                >
                  <ChevronsUpDown className="w-3.5 h-3.5 -rotate-90" />
                </motion.div>
              </AnimatePresence>
            </motion.div>
          )}
        </div>

        <AnimatePresence mode="popLayout">
          {isOpen && showSubType && selectedCategory === "cable" && (
            <motion.div
              initial={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, filter: "blur(8px)" }}
              transition={springTransition}
              className="flex text-[#888] px-2 bg-[#0d0d0d] overflow-hidden rounded-full py-1 gap-1"
            >
              {cableSubTypes.map((st, index) => (
                <motion.div
                  key={st.id}
                  layout
                  initial={{ filter: "blur(8px)", opacity: 0 }}
                  animate={{ filter: "blur(0px)", opacity: 1 }}
                  exit={{ filter: "blur(8px)", opacity: 0 }}
                  transition={{ ...springTransition, delay: index * 0.03 }}
                  onClick={() => setSelectedSubType(st.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-3xl relative transition-colors duration-300 cursor-none text-xs",
                    selectedSubType === st.id ? "text-white" : "text-[#888]"
                  )}
                  data-magnetic
                >
                  <span className="relative z-10">{st.label}</span>
                  {selectedSubType === st.id && (
                    <motion.div
                      transition={springTransition}
                      layoutId="pill-subtype-active"
                      className="absolute h-full w-full bg-[#222] inset-0 rounded-3xl"
                    />
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {fileLimit !== undefined && fileCount !== undefined && (
        <span className="text-xs text-[#888]">
          <span className={cn(atLimit ? "text-error" : "text-white")}>{fileCount}</span>
          {" / "}
          {fileLimit} files
        </span>
      )}
    </div>
  );
}
