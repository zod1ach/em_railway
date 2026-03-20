export function ResultCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="border border-border bg-surface p-5 space-y-3">
      <div className="text-[11px] text-muted font-display tracking-[0.15em]">{label.toUpperCase()}</div>
      <div className="text-xl font-mono font-semibold text-foreground">
        {typeof value === "number" ? value.toExponential(4) : value}
        {unit && <span className="text-xs text-muted ml-2">{unit}</span>}
      </div>
    </div>
  );
}
