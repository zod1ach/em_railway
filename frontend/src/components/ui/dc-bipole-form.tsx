import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnsavedChanges } from "@/components/ui/unsaved-changes";
import { WMMMap, type LinePoint, type WMMMapHandle } from "@/components/ui/wmm-map";
import { CaptureButton } from "@/components/ui/capture-button";
import { api } from "@/lib/api";

/* ── Parameter definitions ── */
interface Param {
  key: string;
  label: string;
  unit: string;
  default: number;
}

const cableParams: Param[] = [
  { key: "r_DC", label: "Cable Radius", unit: "m", default: 0.06 },
  { key: "cable_angle", label: "Cable Angle", unit: "°", default: 15.119 },
  { key: "cable_slope", label: "Cable Slope", unit: "°", default: 0 },
  { key: "I_DC", label: "Current", unit: "A", default: 1000 },
];

const earthParams: Param[] = [
  { key: "B_earth_X", label: "B_earth X", unit: "nT", default: 9578 },
  { key: "B_earth_Y", label: "B_earth Y", unit: "nT", default: 2588 },
  { key: "B_earth_Z", label: "B_earth Z", unit: "nT", default: 53601 },
  { key: "wmm_date", label: "Date", unit: "DD/MM/YYYY", default: "" as any },
];

const allDcParams = [...cableParams, ...earthParams];

/* ── Shared icons ── */
function SuccessIcon({ size = 22 }: { size?: number }) {
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

function LockIcon({ locked, onToggle, size = 22 }: { locked: boolean; onToggle: () => void; size?: number }) {
  return (
    <button onClick={onToggle} className={cn("cursor-none", locked ? "text-red-500" : "text-emerald-500")} title={locked ? "Unlock to edit" : "Lock"}>
      <svg viewBox="0 0 40 40" fill="none" style={{ width: size, height: size }}>
        <rect x="9" y="18" width="22" height="16" rx="3" stroke="currentColor" strokeWidth={2} />
        <motion.path d="M14 18V13a6 6 0 0112 0v5" stroke="currentColor" strokeWidth={2} strokeLinecap="round"
          animate={locked ? { d: "M14 18V13a6 6 0 0112 0v5" } : { d: "M14 18V13a6 6 0 0112 0v2" }}
          transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        />
        <motion.circle cx="20" cy="26" r="2" fill="currentColor"
          animate={locked ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0.4 }}
          transition={{ duration: 0.3 }}
        />
      </svg>
    </button>
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
  const isDate = param.unit === "DD/MM/YYYY";
  const isValid = isDate
    ? (value === "" || /^\d{2}\/\d{2}\/\d{4}$/.test(value))
    : (value === "" || !isNaN(Number(value)));
  const showError = error || !isValid;
  const labelColor = disabled ? "text-white font-bold" : showError ? "text-red-500 font-bold" : "text-[#CCFF00] font-bold";
  const borderColor = disabled ? "border-[#333]" : showError ? "border-red-500" : "border-white/70";

  return (
    <div className={cn("flex flex-col gap-1", disabled && "opacity-30 pointer-events-none")}>
      <span className={cn("text-[11px]", labelColor)}>{param.label}</span>
      <div className="relative">
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          placeholder={String(param.default)}
          className={cn(
            "w-full bg-transparent text-sm text-white pb-1.5 pt-0.5 px-0 pr-12",
            "border-b-[2px] transition-colors", borderColor,
            "focus:border-[#CCFF00] outline-none placeholder:text-[#333]",
            showError && "focus:border-red-500", "cursor-none"
          )}
        />
        {param.unit && (
          <span className={cn("absolute right-0 bottom-2 text-sm font-bold", disabled ? "text-[#555]" : "text-white")}>
            {param.unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── Main form ── */
interface DCBipoleFormProps {
  onClose?: () => void;
  onSave?: (data: { name: string; tag: string; values: Record<string, string>; location?: { lat: number; lng: number } }) => Promise<void> | void;
  existingFile?: {
    name: string;
    tag: string;
    values: Record<string, string>;
    location?: { lat: number; lng: number };
  };
  readOnly?: boolean;
}

export function DCBipoleForm({ onClose, onSave, existingFile, readOnly = false }: DCBipoleFormProps) {
  const formRef = useRef<HTMLDivElement>(null);
  const mapHandleRef = useRef<WMMMapHandle>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) onCloseRef.current?.();
    };
    const timer = setTimeout(() => { document.addEventListener("mousedown", handler); }, 100);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, []);

  const isExisting = !!existingFile;
  const [locked, setLocked] = useState(isExisting || readOnly);
  const [fileName, setFileName] = useState(existingFile?.name ?? "");
  const [fileTag, setFileTag] = useState(existingFile?.tag ?? "");
  const [pinLocation, setPinLocation] = useState<LinePoint | null>(existingFile?.location ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  const defaultValues = useMemo(() => {
    if (existingFile?.values && Object.keys(existingFile.values).length > 0) return { ...existingFile.values };
    const init: Record<string, string> = {};
    allDcParams.forEach((p) => { init[p.key] = String(p.default); });
    return init;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [values, setValues] = useState<Record<string, string>>(() => ({ ...defaultValues }));
  const [savedState, setSavedState] = useState(() => ({
    name: existingFile?.name ?? "",
    tag: existingFile?.tag ?? "",
    values: { ...defaultValues },
    location: existingFile?.location ?? null,
  }));

  const updateValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const hasChanges = useMemo(() => {
    if (fileName !== savedState.name) return true;
    if (fileTag !== savedState.tag) return true;
    return Object.keys(values).some((k) => values[k] !== savedState.values[k]);
  }, [fileName, fileTag, values, savedState]);

  const emptyRequired = useMemo(() => {
    const empty: string[] = [];
    if (!fileName.trim()) empty.push("fileName");
    if (!fileTag.trim()) empty.push("fileTag");
    allDcParams.forEach((p) => { if (!values[p.key]?.trim()) empty.push(p.key); });
    return new Set(empty);
  }, [fileName, fileTag, values]);

  const invalidNumbers = useMemo(() => {
    const invalid: string[] = [];
    allDcParams.forEach((p) => { if (values[p.key] && isNaN(Number(values[p.key]))) invalid.push(p.key); });
    return new Set(invalid);
  }, [values]);

  const hasLocation = !!pinLocation;
  const canSave = emptyRequired.size === 0 && invalidNumbers.size === 0 && hasLocation;

  const handleSave = async () => {
    setTriedSave(true);
    if (!canSave) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2000);
      return;
    }
    setIsSaving(true);
    try {
      await onSave?.({ name: fileName, tag: fileTag, values, location: pinLocation ?? undefined });
      setSavedState({ name: fileName, tag: fileTag, values: { ...values }, location: pinLocation });
      setIsSaving(false);
      setSaveSuccess(true);
      setTriedSave(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("DC Bipole save failed:", err);
      setIsSaving(false);
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2000);
    }
  };

  const handleClear = () => {
    const empty: Record<string, string> = {};
    allDcParams.forEach((p) => { empty[p.key] = ""; });
    setValues(empty);
    setFileName("");
    setFileTag("");
    setPinLocation(null);
    setTriedSave(false);
  };

  const cableRows: Param[][] = [];
  for (let i = 0; i < cableParams.length; i += 3) cableRows.push(cableParams.slice(i, i + 3));

  return (
    <motion.div
      ref={formRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="w-full pb-16"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h3 className={cn("text-sm font-bold transition-colors", hasChanges ? "text-red-500" : "text-[#CCFF00]")}>DC BIPOLE Cable Model</h3>
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
            errorLabel={!hasLocation ? "Location required" : !canSave ? "Fill all required fields" : "Save failed"}
          />
        </div>
        {!locked && (
          <button onClick={handleClear} className="text-[11px] font-bold text-red-500 hover:text-red-400 transition-colors cursor-none">
            Clear
          </button>
        )}
      </div>

      {/* File name + tag */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-[#CCFF00] font-bold">File Name</span>
          <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} disabled={locked}
            placeholder="e.g. North Sea DC Link"
            className={cn("w-full bg-transparent text-sm pb-1.5 pt-0.5 px-0 border-b-[2px] transition-colors outline-none placeholder:text-[#333] cursor-none",
              triedSave && !fileName.trim() ? "text-red-500 border-red-500" : "text-purple-400 border-white/70 focus:border-[#CCFF00]"
            )}
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-[#CCFF00] font-bold">@tag</span>
          <div className="relative">
            <span className="absolute left-0 bottom-1.5 text-sm text-purple-400">@</span>
            <input type="text" value={fileTag} onChange={(e) => setFileTag(e.target.value.replace(/\s/g, "").toLowerCase())} disabled={locked}
              placeholder="shortname"
              className={cn("w-full bg-transparent text-sm pb-1.5 pt-0.5 pl-4 pr-0 border-b-[2px] transition-colors outline-none placeholder:text-[#333] cursor-none font-mono",
                triedSave && !fileTag.trim() ? "text-red-500 border-red-500" : "text-purple-400 border-white/70 focus:border-[#CCFF00]"
              )}
            />
          </div>
        </div>
      </div>

      {/* Cable parameters */}
      <div className="space-y-4 mb-4">
        {cableRows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-3 gap-4">
            {row.map((param) => (
              <ParamField key={param.key} param={param} value={values[param.key]} onChange={(val) => updateValue(param.key, val)}
                disabled={locked} error={triedSave && (emptyRequired.has(param.key) || invalidNumbers.has(param.key))}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="relative my-6">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#333] to-transparent" />
        <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-[#0d0d0d] px-3 text-[9px] text-[#444] uppercase tracking-widest">
          Earth Field
        </span>
      </div>

      {/* B_earth fields — auto-filled by capture or manual */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {earthParams.map((param) => (
          <ParamField key={param.key} param={param} value={values[param.key]} onChange={(val) => updateValue(param.key, val)}
            disabled={locked} error={triedSave && (emptyRequired.has(param.key) || invalidNumbers.has(param.key))}
          />
        ))}
      </div>

      {/* Location fields — bidirectional with map pin */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <ParamField
          param={{ key: "lat", label: "Latitude", unit: "°", default: 50.9 }}
          value={pinLocation ? pinLocation.lat.toFixed(4) : ""}
          onChange={(val) => {
            const lat = parseFloat(val);
            if (isNaN(lat)) return;
            const lng = pinLocation?.lng ?? 0;
            const pt = { lat, lng };
            setPinLocation(pt);
            mapHandleRef.current?.placePin(pt);
          }}
          disabled={locked}
        />
        <ParamField
          param={{ key: "lng", label: "Longitude", unit: "°", default: -1.4 }}
          value={pinLocation ? pinLocation.lng.toFixed(4) : ""}
          onChange={(val) => {
            const lng = parseFloat(val);
            if (isNaN(lng)) return;
            const lat = pinLocation?.lat ?? 0;
            const pt = { lat, lng };
            setPinLocation(pt);
            mapHandleRef.current?.placePin(pt);
          }}
          disabled={locked}
        />
      </div>

      {/* Map — click to set pin for WMM lookup */}
      <WMMMap
        ref={mapHandleRef}
        mode="pin"
        disabled={locked}
        initialPin={pinLocation ?? undefined}
        onPinChange={(pt) => setPinLocation(pt)}
        onClear={() => {
          setPinLocation(null);
          updateValue("B_earth_X", "");
          updateValue("B_earth_Y", "");
          updateValue("B_earth_Z", "");
        }}
        className="w-full h-[270px] border border-[#222] rounded-lg"
      />

      {/* Capture button — fetches B_earth from WMM lookup */}
      <div className="flex items-center justify-between mt-4">
        <CaptureButton
          disabled={locked || !pinLocation}
          onCapture={async () => {
            if (!pinLocation) return;
            const res: any = await api.dcBipoleWmm(pinLocation.lat, pinLocation.lng, values["wmm_date"] || undefined);
            if (res.status === "success") {
              updateValue("B_earth_X", String(res.Bx));
              updateValue("B_earth_Y", String(res.By));
              updateValue("B_earth_Z", String(res.Bz));
            }
          }}
          text="Lookup Earth Field"
          workingText="Fetching WMM..."
          successText="Fields Updated"
          minDuration={3000}
        />
        {!pinLocation && !locked && (
          <span className="text-[10px] text-[#555]">Click map to set location</span>
        )}
      </div>
    </motion.div>
  );
}
