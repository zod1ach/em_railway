import { useState, useRef, useCallback, useLayoutEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from "motion/react";
import { createPortal } from "react-dom";
import { getAvatarUrl } from "@/lib/profiles";

export interface Collaborator {
  id: string;
  full_name: string;
  title?: string;
  affiliation?: string;
  avatar_style: string;
  avatar_seed: string;
  role: "Owner" | "Editor" | "Viewer";
}

function CollaboratorItem({ collaborator }: { collaborator: Collaborator }) {
  const [hovered, setHovered] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const avatarSrc = getAvatarUrl(collaborator.avatar_style, collaborator.avatar_seed);

  // Spring effect
  const mouseX = useMotionValue(0);
  const rotate = useSpring(useTransform(mouseX, [-100, 100], [-25, 25]), {
    stiffness: 150,
    damping: 15,
  });
  const springX = useSpring(useTransform(mouseX, [-100, 100], [-30, 30]), {
    stiffness: 150,
    damping: 15,
  });

  const updatePos = useCallback(() => {
    if (imgRef.current) {
      const rect = imgRef.current.getBoundingClientRect();
      setPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 8,
      });
    }
  }, []);

  useLayoutEffect(() => {
    if (!hovered) return;
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [hovered, updatePos]);

  return (
    <div
      style={{ position: "relative", zIndex: hovered ? 50 : 1, display: "inline-block" }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); mouseX.set(0); }}
    >
      <img
        ref={imgRef}
        onMouseMove={(e) => {
          mouseX.set(e.nativeEvent.offsetX - e.currentTarget.offsetWidth / 2);
          updatePos();
        }}
        src={avatarSrc}
        alt={collaborator.full_name}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid #333",
          background: "white",
          objectFit: "cover",
          transition: "transform 0.3s",
          transform: hovered ? "scale(1.15)" : "scale(1)",
          cursor: "none",
          display: "block",
        }}
      />
      {hovered && createPortal(
        <AnimatePresence>
          {/* Outer wrapper: fixed position + centering (no motion transform) */}
          <div
            style={{
              position: "fixed",
              top: pos.y,
              left: pos.x,
              transform: "translate(-50%, -100%)",
              pointerEvents: "none",
              zIndex: 9999,
            }}
          >
            {/* Inner wrapper: spring effect only */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{ x: springX, rotate }}
            >
              <div className="rounded-lg bg-[#f0ece4] px-2.5 py-1.5 shadow-xl flex flex-col items-center">
                <p className="whitespace-nowrap text-sm font-medium text-[#111]">
                  {collaborator.title ? `${collaborator.title} ` : ""}{collaborator.full_name}
                </p>
                {collaborator.affiliation && (
                  <p className="whitespace-nowrap text-[11px] text-[#555]">
                    {collaborator.affiliation}
                  </p>
                )}
              </div>
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "5px solid transparent",
                  borderRight: "5px solid transparent",
                  borderTop: "5px solid #f0ece4",
                  margin: "0 auto",
                }}
              />
            </motion.div>
          </div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

interface CollaboratorAvatarsProps {
  collaborators: Collaborator[];
  maxShow?: number;
}

export function CollaboratorAvatars({ collaborators, maxShow = 4 }: CollaboratorAvatarsProps) {
  if (collaborators.length === 0) return null;

  const visible = collaborators.slice(0, maxShow);
  const remaining = collaborators.length - maxShow;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {visible.map((c, i) => (
        <div key={c.id} style={{ marginLeft: i > 0 ? -6 : 0 }}>
          <CollaboratorItem collaborator={c} />
        </div>
      ))}
      {remaining > 0 && (
        <div
          style={{ marginLeft: -6 }}
          className="h-6 w-6 rounded-full bg-[#222] border border-[#333] flex items-center justify-center text-[9px] text-[#888] font-bold"
        >
          +{remaining}
        </div>
      )}
    </div>
  );
}
