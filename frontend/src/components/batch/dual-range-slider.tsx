/**
 * Two-thumb range slider for filtering numeric ranges.
 * Snaps to discrete values, CCFF00 accent, dark theme.
 */

import { useCallback } from "react";

interface DualRangeSliderProps {
  min: number;
  max: number;
  step: number;
  values: number[];
  low: number | undefined;
  high: number | undefined;
  unit: string;
  onChange: (low: number | undefined, high: number | undefined) => void;
  label: string;
}

export function DualRangeSlider({
  min,
  max,
  step,
  values,
  low,
  high,
  unit,
  onChange,
  label,
}: DualRangeSliderProps) {
  const currentLow = low ?? min;
  const currentHigh = high ?? max;

  const range = max - min || 1;
  const lowPct = ((currentLow - min) / range) * 100;
  const highPct = ((currentHigh - min) / range) * 100;

  const snapToValue = useCallback(
    (n: number): number => {
      if (values.length === 0) return n;
      let closest = values[0];
      let closestDist = Math.abs(n - closest);
      for (const v of values) {
        const dist = Math.abs(n - v);
        if (dist < closestDist) {
          closest = v;
          closestDist = dist;
        }
      }
      return closest;
    },
    [values],
  );

  const handleLow = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      const snapped = snapToValue(raw);
      onChange(Math.min(snapped, currentHigh), high);
    },
    [snapToValue, currentHigh, high, onChange],
  );

  const handleHigh = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      const snapped = snapToValue(raw);
      onChange(low, Math.max(snapped, currentLow));
    },
    [snapToValue, currentLow, low, onChange],
  );

  const isExact =
    low !== undefined && high !== undefined && Math.abs(low - high) < 1e-9;

  const sliderThumbClass = `absolute w-full h-1 appearance-none bg-transparent pointer-events-none
    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#CCFF00]
    [&::-webkit-slider-thumb]:cursor-none [&::-webkit-slider-thumb]:pointer-events-auto
    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
    [&::-moz-range-thumb]:bg-[#CCFF00] [&::-moz-range-thumb]:border-0
    [&::-moz-range-thumb]:cursor-none [&::-moz-range-thumb]:pointer-events-auto`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[#CCFF00] text-[11px] font-bold uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[#555] text-[11px]">
          {isExact ? `= ${low}` : `${currentLow} — ${currentHigh}`} {unit}
        </span>
      </div>

      <div className="relative h-6 flex items-center">
        <div className="absolute w-full h-1 bg-[#333] rounded-full" />
        <div
          className="absolute h-1 bg-[#CCFF00]/30 rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step || 0.001}
          value={currentLow}
          onChange={handleLow}
          className={`${sliderThumbClass} [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-10`}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step || 0.001}
          value={currentHigh}
          onChange={handleHigh}
          className={`${sliderThumbClass} [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:z-20`}
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <input
          type="number"
          value={low ?? ""}
          placeholder={String(min)}
          onChange={(e) => {
            const val = e.target.value ? parseFloat(e.target.value) : undefined;
            onChange(val, high);
          }}
          className="w-20 bg-transparent border-b border-[#333] text-white text-center py-0.5
                     focus:border-[#CCFF00] focus:outline-none cursor-none"
        />
        <span className="text-[#555]">to</span>
        <input
          type="number"
          value={high ?? ""}
          placeholder={String(max)}
          onChange={(e) => {
            const val = e.target.value ? parseFloat(e.target.value) : undefined;
            onChange(low, val);
          }}
          className="w-20 bg-transparent border-b border-[#333] text-white text-center py-0.5
                     focus:border-[#CCFF00] focus:outline-none cursor-none"
        />
        <span className="text-[#555] text-[11px]">{unit}</span>
        {(low !== undefined || high !== undefined) && (
          <button
            onClick={() => onChange(undefined, undefined)}
            className="text-[#555] hover:text-[#CCFF00] transition-colors cursor-none ml-auto"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
