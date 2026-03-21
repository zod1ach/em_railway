import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ShineBorder } from "@/components/ui/shine-border";
import { SuccessIcon } from "@/components/ui/animated-state-icons";

interface BaseProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

interface DestructiveConfirmProps extends BaseProps {
  mode: "destructive";
  /** The name/label the user must type to confirm */
  name: string;
  /** e.g. "project", "file", "member" */
  itemType?: string;
}

interface StandardConfirmProps extends BaseProps {
  mode: "standard";
  /** The message shown, e.g. "Delete this panel?" */
  message: string;
}

type ConfirmDialogProps = DestructiveConfirmProps | StandardConfirmProps;

export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, onClose, onConfirm, mode } = props;
  const [typedName, setTypedName] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    if (mode === "destructive" && typedName !== props.name) return;
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
      setTypedName("");
    }
  };

  const handleClose = () => {
    setTypedName("");
    onClose();
  };

  const isValid = mode === "standard" || typedName === (props as DestructiveConfirmProps).name;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <ShineBorder
            borderWidth={2}
            borderRadius={16}
            duration={20}
            color={mode === "destructive" ? ["#FF3B3B", "#FF6B6B", "#FF3B3B"] : ["#CCFF00", "#00C2FF", "#CCFF00"]}
            className="bg-[#0d0d0d]/95 backdrop-blur-xl shadow-2xl"
          >
            <div className="relative z-10 w-full p-6">
              {mode === "destructive" ? (
                /* ── Destructive mode ── */
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-display tracking-[0.1em] text-white mb-1">
                      DESTRUCTIVE CHANGES
                    </h3>
                    <p className="text-sm text-[#888]">
                      Are you sure? This cannot be undone.
                    </p>
                  </div>

                  <p className="text-sm text-[#ccc]">
                    Please type{" "}
                    <span className="font-bold text-red-400">
                      "{(props as DestructiveConfirmProps).name}"
                    </span>{" "}
                    to confirm deletion.
                  </p>

                  <input
                    type="text"
                    value={typedName}
                    onChange={(e) => setTypedName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && isValid) handleConfirm(); }}
                    placeholder="Type the name to confirm..."
                    className="w-full bg-[#111] border border-[#333] rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#555] focus:outline-none focus:border-red-500/50 transition-colors"
                    autoFocus
                  />

                  <button
                    onClick={handleConfirm}
                    disabled={!isValid || confirming}
                    className="w-full h-11 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-none"
                  >
                    {confirming ? (
                      <SuccessIcon size={20} color="white" duration={99999} />
                    ) : (
                      <>
                        <SuccessIcon size={20} color="white" duration={99999} />
                        Delete {(props as DestructiveConfirmProps).itemType ?? "item"}
                      </>
                    )}
                  </button>
                </div>
              ) : (
                /* ── Standard mode ── */
                <div className="space-y-4">
                  <div>
                    <h3 className="text-base font-display tracking-[0.1em] text-white mb-1">
                      CONFIRM
                    </h3>
                    <p className="text-sm text-[#ccc]">
                      {(props as StandardConfirmProps).message}
                    </p>
                  </div>

                  <button
                    onClick={handleConfirm}
                    disabled={confirming}
                    className="w-full h-11 rounded-xl bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-none"
                  >
                    {confirming ? (
                      <SuccessIcon size={20} color="black" duration={99999} />
                    ) : (
                      <>
                        <SuccessIcon size={20} color="black" duration={99999} />
                        Yes
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </ShineBorder>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
