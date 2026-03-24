import { ComponentProps, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/* ── 5×5 dot grid (7×7 minus outer ring) ── */

type MiniDotGridProps = {
  frames: number[][];
  dotClassName?: string;
  isPlaying?: boolean;
  duration?: number;
  repeatCount?: number;
} & ComponentProps<"div">;

function MiniDotGrid({
  frames,
  isPlaying = true,
  duration = 100,
  dotClassName,
  className,
  repeatCount = -1,
  ...props
}: MiniDotGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const currentIndex = useRef(0);
  const repeats = useRef(0);
  const interval = useRef<NodeJS.Timeout>(null);

  const applyFrame = useCallback(
    (dots: HTMLDivElement[], frameIndex: number) => {
      const frame = frames[frameIndex];
      if (!frame) return;
      dots.forEach((dot, index) => {
        dot.classList.toggle("active", frame.includes(index));
      });
    },
    [frames],
  );

  useEffect(() => {
    currentIndex.current = 0;
    repeats.current = 0;
  }, [frames]);

  useEffect(() => {
    if (isPlaying) {
      if (currentIndex.current >= frames.length) currentIndex.current = 0;
      const dots = Array.from(
        gridRef.current?.children ?? [],
      ) as HTMLDivElement[];
      if (!dots.length) return;

      interval.current = setInterval(() => {
        applyFrame(dots, currentIndex.current);
        if (currentIndex.current + 1 >= frames.length) {
          if (repeatCount !== -1 && repeats.current + 1 >= repeatCount) {
            clearInterval(interval.current!);
          }
          repeats.current++;
        }
        currentIndex.current = (currentIndex.current + 1) % frames.length;
      }, duration);
    } else {
      if (interval.current) clearInterval(interval.current);
    }
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [frames, isPlaying, applyFrame, duration, repeatCount]);

  return (
    <div
      {...props}
      ref={gridRef}
      className={cn("grid w-fit grid-cols-5 gap-0.5", className)}
    >
      {Array.from({ length: 25 }).map((_, i) => (
        <div
          key={i}
          className={cn("h-1.5 w-1.5 rounded-sm", dotClassName)}
        />
      ))}
    </div>
  );
}

/*
 * Remap 7×7 → 5×5 (keep rows 1-5, cols 1-5 of the original grid).
 * Original valid positions:
 *   Row1: 8-12, Row2: 15-19, Row3: 22-26, Row4: 29-33, Row5: 36-40
 * New index = (origRow - 1) * 5 + (origCol - 1)
 */
const VALID_SET = new Set([
  8,9,10,11,12, 15,16,17,18,19, 22,23,24,25,26, 29,30,31,32,33, 36,37,38,39,40,
]);

function remap7to5(indices: number[]): number[] {
  return indices
    .filter((i) => VALID_SET.has(i))
    .map((i) => {
      const row = Math.floor(i / 7) - 1;
      const col = (i % 7) - 1;
      return row * 5 + col;
    });
}

const plusFrames7x7: number[][] = [
  [],
  [24],
  [17, 23, 25, 31, 24],
  [10, 16, 18, 38, 30, 32, 3, 45, 17, 23, 25, 31, 24],
  [17, 23, 25, 31, 24],
  [10, 16, 18, 38, 30, 32, 3, 45, 17, 23, 25, 31, 24],
  [17, 23, 25, 31, 24],
  [24],
  [],
];

const plusFrames = plusFrames7x7.map(remap7to5);

export function CanvasPlusButton({ onClick }: { onClick?: () => void }) {
  return (
    <button onClick={onClick} className="cursor-none">
      <MiniDotGrid
        frames={plusFrames}
        isPlaying
        className="gap-px"
        repeatCount={-1}
        duration={150}
        dotClassName="bg-white/15 [&.active]:bg-white size-1"
      />
    </button>
  );
}
