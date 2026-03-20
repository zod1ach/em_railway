import { Input } from "./ui/Input";
import { ReactNode } from "react";

export interface ParamDef {
  key: string;
  label: string;
  unit?: string;
  default: number;
  step?: number;
}

interface Props {
  defs: ParamDef[];
  values: Record<string, number>;
  onChange: (key: string, val: number) => void;
  children?: ReactNode;
  cols?: number;
}

export function ParamForm({ defs, values, onChange, children, cols }: Props) {
  const gridCols = cols === 4
    ? "grid-cols-2 md:grid-cols-4"
    : cols === 5
    ? "grid-cols-2 md:grid-cols-5"
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {defs.map((d) => (
        <Input
          key={d.key}
          id={d.key}
          label={d.label.toUpperCase()}
          unit={d.unit}
          type="number"
          step={d.step ?? "any"}
          value={values[d.key] ?? d.default}
          onChange={(e) => onChange(d.key, parseFloat(e.target.value) || 0)}
        />
      ))}
      {children}
    </div>
  );
}
