import { cn } from "@/lib/utils";

type TColorProp = string | string[];

interface ShineBorderProps {
  borderRadius?: number;
  borderWidth?: number;
  duration?: number;
  color?: TColorProp;
  className?: string;
  children: React.ReactNode;
}

export function ShineBorder({
  borderRadius = 16,
  borderWidth = 2,
  duration = 8,
  color = "#000000",
  className,
  children,
}: ShineBorderProps) {
  const colorStr = color instanceof Array ? color.join(",") : color;

  return (
    <div
      style={{
        borderRadius: `${borderRadius}px`,
        position: "relative",
      }}
      className={cn(
        "grid h-full w-full place-items-center bg-[#0d0d0d] text-white",
        className,
      )}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: `${borderRadius}px`,
          padding: `${borderWidth}px`,
          background: `radial-gradient(transparent, transparent, ${colorStr}, transparent, transparent)`,
          backgroundSize: "300% 300%",
          animation: `shine-pulse ${duration}s infinite linear`,
          WebkitMask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          WebkitMaskComposite: "xor",
          mask: `linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)`,
          maskComposite: "exclude",
        }}
      />
      {children}
    </div>
  );
}
