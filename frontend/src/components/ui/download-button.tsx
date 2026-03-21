import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface DownloadButtonProps {
  onClick: () => void | Promise<void>;
  size?: number;
  color?: string;
  className?: string;
}

/**
 * Animated download button — shows arrow, morphs to checkmark on click,
 * then resets after a delay.
 */
export function DownloadButton({ onClick, size = 18, color = "currentColor", className = "" }: DownloadButtonProps) {
  const [done, setDone] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (done) return;
    try {
      await onClick();
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // Download failed — don't show success
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`p-1.5 rounded-lg hover:bg-[#222] text-[#666] hover:text-white transition-colors cursor-none ${className}`}
      title={done ? "Downloaded" : "Download"}
    >
      <svg viewBox="0 0 40 40" fill="none" style={{ width: size, height: size }}>
        <path d="M8 28v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <AnimatePresence mode="wait">
          {done ? (
            <motion.path
              key="check"
              d="M14 22l6 6 8-10"
              stroke="#CCFF00"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              exit={{ pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
            />
          ) : (
            <motion.g
              key="arrow"
              initial={{ y: -4, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 8, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
            >
              <line x1="20" y1="6" x2="20" y2="24" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
              <polyline points="14,18 20,24 26,18" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </button>
  );
}
