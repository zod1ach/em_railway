import { useRef, useEffect } from "react";
import Avatar from "boring-avatars";

const COLORS = ["#CCFF00", "#00C2FF", "#FF6B6B", "#A855F7", "#F59E0B"];

interface ProjectAvatarProps {
  projectId: string;
  className?: string;
}

/**
 * Renders a deterministic generative marble pattern for a project.
 * Strips the fixed width/height from boring-avatars SVG so it fills its container.
 */
export function ProjectAvatar({ projectId, className = "" }: ProjectAvatarProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const svg = el.querySelector("svg");
    if (svg) {
      svg.removeAttribute("width");
      svg.removeAttribute("height");
      svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
      svg.style.width = "100%";
      svg.style.height = "100%";
      svg.style.display = "block";
    }
  });

  return (
    <div ref={wrapperRef} className={`overflow-hidden rounded-2xl ${className}`}>
      <Avatar
        size={80}
        square
        name={projectId}
        variant="marble"
        colors={COLORS}
      />
    </div>
  );
}
