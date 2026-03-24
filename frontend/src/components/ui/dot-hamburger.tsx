import { useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";

/*
 * 5×5 dot-grid hamburger button — same visual style as CanvasPlusButton.
 *
 * Closed (≡): three horizontal lines pulse in a loop
 * Open   (×): two diagonals pulse in a loop
 * Toggling: morphs between the two patterns
 */

/* ── static patterns ── */
const HAMBURGER_FULL = [0,1,2,3,4, 10,11,12,13,14, 20,21,22,23,24];
const HAMBURGER_MID  = [10,11,12,13,14];
const HAMBURGER_OUTER = [0,1,2,3,4, 20,21,22,23,24];

const CROSS_FULL  = [0,4,6,8,12,16,18,20,24];
const CROSS_INNER = [6,8,12,16,18];
const CROSS_OUTER = [0,4,20,24];

/* ── looping frames ── */
const HAMBURGER_LOOP: number[][] = [
  HAMBURGER_FULL,
  HAMBURGER_FULL,
  HAMBURGER_MID,
  HAMBURGER_FULL,
  HAMBURGER_MID,
  HAMBURGER_FULL,
  HAMBURGER_FULL,
  [],
];

const CROSS_LOOP: number[][] = [
  CROSS_FULL,
  CROSS_FULL,
  CROSS_INNER,
  CROSS_FULL,
  CROSS_INNER,
  CROSS_FULL,
  CROSS_FULL,
  [],
];

/* ── morph transitions ── */
const HAMBURGER_TO_CROSS: number[][] = [
  HAMBURGER_FULL,
  [...HAMBURGER_OUTER, 6,8,12,16,18],
  CROSS_FULL,
];

const CROSS_TO_HAMBURGER: number[][] = [
  CROSS_FULL,
  [...CROSS_OUTER, 1,2,3, 12, 21,22,23],
  HAMBURGER_FULL,
];

interface DotHamburgerProps {
  open: boolean;
  onClick: () => void;
}

export function DotHamburger({ open, onClick }: DotHamburgerProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const prevOpen = useRef(open);
  const loopInterval = useRef<NodeJS.Timeout | null>(null);
  const morphTimeout = useRef<NodeJS.Timeout | null>(null);

  const applyPattern = (dots: HTMLDivElement[], active: number[]) => {
    const set = new Set(active);
    dots.forEach((dot, i) => dot.classList.toggle("active", set.has(i)));
  };

  const getDots = () =>
    Array.from(gridRef.current?.children ?? []) as HTMLDivElement[];

  /* Start the idle loop */
  const startLoop = (frames: number[][]) => {
    if (loopInterval.current) clearInterval(loopInterval.current);
    let idx = 0;
    const dots = getDots();
    if (!dots.length) return;
    applyPattern(dots, frames[0]);
    loopInterval.current = setInterval(() => {
      idx = (idx + 1) % frames.length;
      applyPattern(dots, frames[idx]);
    }, 150);
  };

  /* On open/close change: morph then loop */
  useEffect(() => {
    const dots = getDots();
    if (!dots.length) return;

    /* Clean up previous animations */
    if (loopInterval.current) clearInterval(loopInterval.current);
    if (morphTimeout.current) clearTimeout(morphTimeout.current);

    const changed = prevOpen.current !== open;
    prevOpen.current = open;

    if (!changed) {
      /* Initial mount — just start looping */
      startLoop(open ? CROSS_LOOP : HAMBURGER_LOOP);
      return;
    }

    /* Play morph frames then start loop */
    const morphFrames = open ? HAMBURGER_TO_CROSS : CROSS_TO_HAMBURGER;
    let idx = 0;
    applyPattern(dots, morphFrames[0]);

    const morphInterval = setInterval(() => {
      idx++;
      if (idx >= morphFrames.length) {
        clearInterval(morphInterval);
        startLoop(open ? CROSS_LOOP : HAMBURGER_LOOP);
        return;
      }
      applyPattern(dots, morphFrames[idx]);
    }, 80);

    return () => {
      clearInterval(morphInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* Cleanup on unmount */
  useEffect(() => {
    return () => {
      if (loopInterval.current) clearInterval(loopInterval.current);
      if (morphTimeout.current) clearTimeout(morphTimeout.current);
    };
  }, []);

  return (
    <button onClick={onClick} className="cursor-none">
      <div ref={gridRef} className="grid w-fit grid-cols-5 gap-px">
        {Array.from({ length: 25 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-sm bg-white/15 size-1",
              "[&.active]:bg-white",
            )}
          />
        ))}
      </div>
    </button>
  );
}
