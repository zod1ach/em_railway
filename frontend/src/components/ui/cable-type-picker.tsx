import * as React from "react";
import { motion, AnimatePresence, MotionConfig } from "motion/react";

interface CableTypePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (subType: "hvac" | "dc_bipole") => void;
}

const options = [
  { id: "hvac" as const, label: "HVAC" },
  { id: "dc_bipole" as const, label: "DC BIPOLE" },
];

export function CableTypePicker({ open, onClose, onSelect }: CableTypePickerProps) {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [open, onClose]);

  return (
    <MotionConfig reducedMotion="user">
      <div ref={ref} className="relative inline-flex">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{
                opacity: 1,
                width: "auto",
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
              }}
              exit={{
                opacity: 0,
                width: 0,
                transition: { type: "spring", stiffness: 500, damping: 30, mass: 1 },
              }}
              className="absolute left-full top-1/2 -translate-y-1/2 ml-1 overflow-hidden z-50"
              onKeyDown={(e) => e.key === "Escape" && onClose()}
            >
              <div className="flex items-center gap-2 whitespace-nowrap">
                {options.map((opt) => (
                  <motion.button
                    key={opt.id}
                    onClick={() => { onSelect(opt.id); onClose(); }}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
                    whileTap={{ scale: 0.96 }}
                    className="text-xs text-white font-bold hover:text-[#CCFF00] transition-colors cursor-none"
                  >
                    {opt.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
