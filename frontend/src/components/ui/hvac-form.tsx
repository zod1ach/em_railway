import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { UnsavedChanges } from "@/components/ui/unsaved-changes";

/* ── Parameter definitions ── */
interface Param {
  key: string;
  label: string;
  unit: string;
  default: number;
}

const coreParams: Param[] = [
  { key: "p_c", label: "Lay Length", unit: "m", default: 2.75 },
  { key: "R_h", label: "Helix Radius", unit: "m", default: 0.060391 },
  { key: "r_AC", label: "Cable Radius", unit: "m", default: 0.1225 },
  { key: "d_s", label: "Sheath Diameter", unit: "m", default: 0.0958 },
  { key: "R_s", label: "Sheath Resistance", unit: "Ω/m", default: 2398.15e-7 },
  { key: "f", label: "Frequency", unit: "Hz", default: 50 },
  { key: "I_AC", label: "Current", unit: "A", default: 1000 },
  { key: "N_calc", label: "Harmonics", unit: "", default: 10 },
  { key: "s", label: "Conductor Spacing", unit: "m", default: 0.0892 },
];

const magneticParams: Param[] = [
  { key: "N", label: "Armour Wires", unit: "", default: 110 },
  { key: "d_f", label: "Wire Diameter", unit: "m", default: 0.0056 },
  { key: "d_A", label: "Armour Diameter", unit: "m", default: 0.2056 },
  { key: "p_A", label: "Armour Pitch", unit: "m", default: 3.084 },
  { key: "lay_factor", label: "Lay Factor", unit: "", default: -1 },
  { key: "mu_r_real", label: "μr (Real)", unit: "", default: 100 },
  { key: "mu_r_imag", label: "μr (Imag)", unit: "", default: -50 },
  { key: "sigma", label: "Conductivity", unit: "S/m", default: 4.03e6 },
  { key: "t", label: "Wire Thickness", unit: "m", default: 0.005 },
];

/* ── Toggle icon ── */
function MagneticToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="cursor-none" title={on ? "Magnetic ON" : "Magnetic OFF"}>
      <svg viewBox="0 0 40 40" fill="none" style={{ width: 36, height: 36 }}>
        <motion.rect x="5" y="13" width="30" height="14" rx="7"
          animate={on ? { fill: "#CCFF00", opacity: 0.2 } : { fill: "currentColor", opacity: 0.08 }}
          transition={{ duration: 0.3 }}
        />
        <rect x="5" y="13" width="30" height="14" rx="7"
          stroke={on ? "#CCFF00" : "currentColor"} strokeWidth={2} opacity={on ? 1 : 0.4}
        />
        <motion.circle cy="20" r="5"
          fill={on ? "#CCFF00" : "currentColor"}
          animate={on ? { cx: 28 } : { cx: 12 }}
          transition={{ type: "spring", stiffness: 500, damping: 25 }}
        />
      </svg>
    </button>
  );
}

/* ── Success icon (from animated-state-icons) ── */
function SuccessIcon({ size = 24 }: { size?: number }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" style={{ width: size, height: size }}>
      <motion.circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth={2}
        initial={{ pathLength: 0.7, opacity: 0.4 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      <motion.path d="M12 20l6 6 10-12" stroke="currentColor" strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      />
    </svg>
  );
}

/* ── Field component ── */
function ParamField({
  param, value, onChange, disabled, error,
}: {
  param: Param;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const isValid = value === "" || !isNaN(Number(value));
  const showError = error || !isValid;

  const labelColor = disabled
    ? "text-white font-bold"
    : showError
      ? "text-red-500 font-bold"
      : "text-[#CCFF00] font-bold";

  const borderColor = disabled
    ? "border-[#333]"
    : showError
      ? "border-red-500"
      : "border-white/70";

  return (
    <div className={cn("flex flex-col gap-1", disabled && "opacity-30 pointer-events-none")}>
      <span className={cn("text-[11px]", labelColor)}>{param.label}</span>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={String(param.default)}
          className={cn(
            "w-full bg-transparent text-sm text-white pb-1.5 pt-0.5 px-0 pr-12",
            "border-b-[2px] transition-colors",
            borderColor,
            "focus:border-[#CCFF00]",
            "outline-none placeholder:text-[#333]",
            showError && "focus:border-red-500",
            "cursor-none"
          )}
        />
        {param.unit && (
          <span className={cn(
            "absolute right-0 bottom-2 text-sm font-bold",
            disabled ? "text-[#555]" : "text-white"
          )}>
            {param.unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main form ── */
interface HvacFormProps {
  onClose?: () => void;
  onSave?: (data: { name: string; tag: string; magnetic: boolean; values: Record<string, string> }) => Promise<void> | void;
  existingFile?: {
    name: string;
    tag: string;
    magnetic: boolean;
    values: Record<string, string>;
  };
  /** View-only mode — no lock icon, no editing */
  readOnly?: boolean;
}

/* ── Lock icon (from animated-state-icons) ── */
function LockIcon({ locked, onToggle, size = 22 }: { locked: boolean; onToggle: () => void; size?: number }) {
  return (
    <button onClick={onToggle} className={cn("cursor-none", locked ? "text-red-500" : "text-emerald-500")} title={locked ? "Unlock to edit" : "Lock"}>
      <svg viewBox="0 0 40 40" fill="none" style={{ width: size, height: size }}>
        <rect x="9" y="18" width="22" height="16" rx="3" stroke="currentColor" strokeWidth={2} />
        <motion.path
          d="M14 18V13a6 6 0 0112 0v5"
          stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          animate={locked ? { d: "M14 18V13a6 6 0 0112 0v5" } : { d: "M14 18V13a6 6 0 0112 0v2" }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        />
        <motion.circle
          cx="20" cy="26" r="2" fill="currentColor"
          animate={locked ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0.4 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
    </button>
  );
}

export function HvacForm({ onClose, onSave, existingFile, readOnly = false }: HvacFormProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        onCloseRef.current?.();
      }
    };
    // Small delay so the click that opened the form doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, []);

  const isExisting = !!existingFile;
  const [locked, setLocked] = useState(isExisting || readOnly);
  const [magnetic, setMagnetic] = useState(existingFile?.magnetic ?? false);
  const [fileName, setFileName] = useState(existingFile?.name ?? "");
  const [fileTag, setFileTag] = useState(existingFile?.tag ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  const allParams = [...coreParams, ...magneticParams];
  const defaultValues = useMemo(() => {
    if (existingFile?.values) return { ...existingFile.values };
    const init: Record<string, string> = {};
    allParams.forEach((p) => { init[p.key] = String(p.default); });
    return init;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [values, setValues] = useState<Record<string, string>>(() => ({ ...defaultValues }));
  const [savedState, setSavedState] = useState(() => ({
    name: existingFile?.name ?? "",
    tag: existingFile?.tag ?? "",
    magnetic: existingFile?.magnetic ?? false,
    values: { ...defaultValues },
  }));

  const updateValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  // Validation
  const hasChanges = useMemo(() => {
    if (fileName !== savedState.name) return true;
    if (fileTag !== savedState.tag) return true;
    if (magnetic !== savedState.magnetic) return true;
    return Object.keys(values).some((k) => values[k] !== savedState.values[k]);
  }, [fileName, fileTag, magnetic, values, savedState]);

  const emptyRequired = useMemo(() => {
    const empty: string[] = [];
    if (!fileName.trim()) empty.push("fileName");
    if (!fileTag.trim()) empty.push("fileTag");
    coreParams.forEach((p) => { if (!values[p.key]?.trim()) empty.push(p.key); });
    if (magnetic) {
      magneticParams.forEach((p) => { if (!values[p.key]?.trim()) empty.push(p.key); });
    }
    return new Set(empty);
  }, [fileName, fileTag, values, magnetic]);

  const invalidNumbers = useMemo(() => {
    const invalid: string[] = [];
    coreParams.forEach((p) => { if (values[p.key] && isNaN(Number(values[p.key]))) invalid.push(p.key); });
    if (magnetic) {
      magneticParams.forEach((p) => { if (values[p.key] && isNaN(Number(values[p.key]))) invalid.push(p.key); });
    }
    return new Set(invalid);
  }, [values, magnetic]);

  const canSave = emptyRequired.size === 0 && invalidNumbers.size === 0;

  const handleSave = async () => {
    setTriedSave(true);
    if (!canSave) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2000);
      return;
    }
    setIsSaving(true);
    try {
      await onSave?.({ name: fileName, tag: fileTag, magnetic, values });
      setSavedState({ name: fileName, tag: fileTag, magnetic, values: { ...values } });
      setIsSaving(false);
      setSaveSuccess(true);
      setTriedSave(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("HVAC save failed:", err);
      setIsSaving(false);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2000);
    }
  };

  const handleClear = () => {
    const empty: Record<string, string> = {};
    allParams.forEach((p) => { empty[p.key] = ""; });
    setValues(empty);
    setFileName("");
    setFileTag("");
    setTriedSave(false);
  };

  const coreRows: Param[][] = [];
  for (let i = 0; i < coreParams.length; i += 3) coreRows.push(coreParams.slice(i, i + 3));
  const magRows: Param[][] = [];
  for (let i = 0; i < magneticParams.length; i += 3) magRows.push(magneticParams.slice(i, i + 3));

  return (
    <motion.div
      ref={formRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full pb-16"
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h3 className={cn("text-sm font-bold transition-colors", hasChanges ? "text-red-500" : "text-[#CCFF00]")}>HVAC Cable Model</h3>
          {!readOnly && (!isExisting || !locked) && (
            <button onClick={handleSave} className="cursor-none text-[#CCFF00]" title="Save">
              <SuccessIcon size={22} />
            </button>
          )}
          {isExisting && !readOnly && (
            <LockIcon locked={locked} onToggle={() => setLocked((v) => !v)} size={22} />
          )}
          <UnsavedChanges
            open={isSaving || saveSuccess || saveError}
            isSaving={isSaving}
            success={saveSuccess}
            error={saveError}
            hideReset
            savingLabel="Saving…"
            successLabel="Changes saved"
            errorLabel={!canSave ? "Fill all required fields" : "Save failed"}
          />
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-white">
              {magnetic ? "Magnetic Armour" : "Non-Magnetic"}
            </span>
            <MagneticToggle on={magnetic} onToggle={() => { if (!locked) setMagnetic((v) => !v); }} />
          </div>
          {!locked && (
            <button
              onClick={handleClear}
              className="text-[11px] font-bold text-red-500 hover:text-red-400 transition-colors cursor-none mr-1.5"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* File name + tag */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-[#CCFF00] font-bold">File Name</span>
          <input
            type="text"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            disabled={locked}
            placeholder="e.g. North Sea HVAC"
            className={cn(
              "w-full bg-transparent text-sm pb-1.5 pt-0.5 px-0",
              "border-b-[2px] transition-colors outline-none placeholder:text-[#333] cursor-none",
              triedSave && !fileName.trim() ? "text-red-500 border-red-500" : "text-purple-400 border-white/70 focus:border-[#CCFF00]"
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-[#CCFF00] font-bold">@tag</span>
          <div className="relative">
            <span className="absolute left-0 bottom-1.5 text-sm text-purple-400">@</span>
            <input
              type="text"
              value={fileTag}
              onChange={(e) => setFileTag(e.target.value.replace(/\s/g, "").toLowerCase())}
              disabled={locked}
              placeholder="shortname"
              className={cn(
                "w-full bg-transparent text-sm pb-1.5 pt-0.5 pl-4 pr-0",
                "border-b-[2px] transition-colors outline-none placeholder:text-[#333] cursor-none font-mono",
                triedSave && !fileTag.trim() ? "text-red-500 border-red-500" : "text-purple-400 border-white/70 focus:border-[#CCFF00]"
              )}
            />
          </div>
        </div>
      </div>

      {/* Core parameters */}
      <div className="space-y-4">
        {coreRows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-4">
            {row.map((param) => (
              <ParamField
                key={param.key}
                param={param}
                value={values[param.key]}
                onChange={(val) => updateValue(param.key, val)}
                disabled={locked}
                error={triedSave && (emptyRequired.has(param.key) || invalidNumbers.has(param.key))}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="relative my-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-[#0d0d0d] px-3 text-[9px] text-[#444] uppercase tracking-widest">
          Armour
        </span>
      </div>

      {/* Magnetic parameters */}
      <div className="space-y-4">
        {magRows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-4">
            {row.map((param) => (
              <ParamField
                key={param.key}
                param={param}
                value={values[param.key]}
                onChange={(val) => updateValue(param.key, val)}
                disabled={locked || !magnetic}
                error={triedSave && magnetic && (emptyRequired.has(param.key) || invalidNumbers.has(param.key))}
              />
            ))}
          </div>
        ))}
      </div>

    </motion.div>
  );
}
