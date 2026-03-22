import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { UnsavedChanges } from "@/components/ui/unsaved-changes";
import { WMMMap, type BBox, type LinePoint, type WMMMapHandle } from "@/components/ui/wmm-map";
import { CaptureButton } from "@/components/ui/capture-button";
import { interpolateLinePoints, maxTeamPoints, totalLineKm } from "@/lib/geo-utils";

/* ── Parameter definitions ── */
interface Param {
  key: string;
  label: string;
  unit: string;
  default: number | string;
  type?: "number" | "text";
}

const gridParams: Param[] = [
  { key: "dpi", label: "DPI", unit: "px", default: 150 },
  { key: "date", label: "Date", unit: "DD/MM/YYYY", default: "", type: "text" },
];

const lineParams: Param[] = [
  { key: "n_points", label: "Interpolation Points", unit: "", default: 200 },
  { key: "date_line", label: "Date", unit: "DD/MM/YYYY", default: "", type: "text" },
];

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

/* ── Field ── */
function ParamField({
  param, value, onChange, disabled, error,
}: {
  param: Param;
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  error?: boolean;
}) {
  const isNumeric = param.type !== "text";
  const isDate = param.unit === "DD/MM/YYYY";
  const isValidDate = (v: string) => {
    if (!v) return true;
    return /^\d{2}\/\d{2}\/\d{4}$/.test(v);
  };
  const isValid = isDate ? isValidDate(value) : (!isNumeric || value === "" || !isNaN(Number(value)));
  const showError = error || !isValid;
  const labelColor = disabled ? "text-white font-bold" : showError ? "text-red-500 font-bold" : "text-[#CCFF00] font-bold";
  const borderColor = disabled ? "border-[#333]" : showError ? "border-red-500" : "border-white/70";

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
interface WMMFormProps {
  onClose?: () => void;
  onSave?: (data: { name: string; tag: string; mode: "grid" | "line"; values: Record<string, string>; coordinates?: string; waypoints?: string }) => Promise<void> | void;
  existingFile?: {
    name: string;
    tag: string;
    mode: "grid" | "line";
    values: Record<string, string>;
    coordinates?: string;
    waypoints?: string;
  };
  initialMode?: "grid" | "line";
  readOnly?: boolean;
  isTeam?: boolean;
}

export function WMMForm({ onClose, onSave, existingFile, initialMode, readOnly = false, isTeam = false }: WMMFormProps) {
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

  // Toggle marker draggability when lock changes
  const handleToggleLock = useCallback(() => {
    const newLocked = !locked;
    setLocked(newLocked);
    if (!newLocked) {
      // Unlocked — enable waypoint dragging
      mapHandleRef.current?.setMarkersEnabled(true);
    } else {
      // Locked — disable waypoint dragging
      mapHandleRef.current?.setMarkersEnabled(false);
    }
  }, [locked]);
  const mode = existingFile?.mode ?? initialMode ?? "grid";
  const [fileName, setFileName] = useState(existingFile?.name ?? "");
  const [fileTag, setFileTag] = useState(existingFile?.tag ?? "");
  const [coordinates, setCoordinates] = useState(existingFile?.coordinates ?? "");
  // Reconstruct bbox/line from saved values
  const savedBBox = useMemo<BBox | null>(() => {
    const v = existingFile?.values;
    if (!v?.lon0 || !v?.lon1 || !v?.lat0 || !v?.lat1) return null;
    return { lonMin: +v.lon0, lonMax: +v.lon1, latMin: +v.lat0, latMax: +v.lat1 };
  }, [existingFile]);

  const savedLine = useMemo<LinePoint[]>(() => {
    // Use waypoints (original clicks) for rendering, not all coordinates
    const wpStr = existingFile?.waypoints;
    if (wpStr) {
      return wpStr.split("\n").filter(Boolean).map((l) => {
        const [lng, lat] = l.split(",").map(Number);
        return { lng, lat };
      });
    }
    // Fallback to coordinates if no waypoints saved (legacy data)
    const coordStr = existingFile?.coordinates;
    if (!coordStr) return [];
    return coordStr.split("\n").filter(Boolean).map((l) => {
      const [lng, lat] = l.split(",").map(Number);
      return { lng, lat };
    });
  }, [existingFile]);

  const [bbox, setBBox] = useState<BBox | null>(savedBBox);
  const [linePoints, setLinePoints] = useState<LinePoint[]>(savedLine);
  const [capturedCoords, setCapturedCoords] = useState<{ lon: number; lat: number }[] | null>(() => {
    if (savedBBox) {
      return [
        { lon: savedBBox.lonMin, lat: savedBBox.latMin },
        { lon: savedBBox.lonMax, lat: savedBBox.latMin },
        { lon: savedBBox.lonMax, lat: savedBBox.latMax },
        { lon: savedBBox.lonMin, lat: savedBBox.latMax },
      ];
    }
    return null;
  });
  const [captured, setCaptured] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [triedSave, setTriedSave] = useState(false);

  const allParams = [...gridParams, ...lineParams];
  const defaultValues = useMemo(() => {
    if (existingFile?.values && Object.keys(existingFile.values).length > 0) return { ...existingFile.values };
    const init: Record<string, string> = {};
    allParams.forEach((p) => { init[p.key] = String(p.default); });
    return init;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [values, setValues] = useState<Record<string, string>>(() => ({ ...defaultValues }));
  const [savedState, setSavedState] = useState(() => ({
    name: existingFile?.name ?? "",
    tag: existingFile?.tag ?? "",
    mode: existingFile?.mode ?? "grid" as "grid" | "line",
    values: { ...defaultValues },
    coordinates: existingFile?.coordinates ?? "-5,50\n0,55\n3,58",
  }));

  const updateValue = useCallback((key: string, val: string) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const hasChanges = useMemo(() => {
    if (fileName !== savedState.name) return true;
    if (fileTag !== savedState.tag) return true;
    if (mode !== savedState.mode) return true;
    if (coordinates !== savedState.coordinates) return true;
    return Object.keys(values).some((k) => values[k] !== savedState.values[k]);
  }, [fileName, fileTag, mode, coordinates, values, savedState]);

  const activeParams = mode === "grid" ? gridParams : lineParams;

  const emptyRequired = useMemo(() => {
    const empty: string[] = [];
    if (!fileName.trim()) empty.push("fileName");
    if (!fileTag.trim()) empty.push("fileTag");
    activeParams.forEach((p) => { if (!values[p.key]?.trim()) empty.push(p.key); });
    return new Set(empty);
  }, [fileName, fileTag, values, activeParams]);

  const invalidNumbers = useMemo(() => {
    const invalid: string[] = [];
    activeParams.forEach((p) => {
      if (p.type === "text") return;
      if (values[p.key] && isNaN(Number(values[p.key]))) invalid.push(p.key);
    });
    return new Set(invalid);
  }, [values, activeParams]);

  const hasCoords = mode === "grid" ? !!bbox : linePoints.length >= 2;
  const canSave = emptyRequired.size === 0 && invalidNumbers.size === 0 && hasCoords;

  const handleSave = async () => {
    setTriedSave(true);
    if (!canSave) {
      setSaveError(true);
      setTimeout(() => setSaveError(false), 2000);
      return;
    }
    setIsSaving(true);
    try {
      // Save waypoints separately from interpolated coordinates
      const waypointStr = linePoints.map((p) => `${p.lng.toFixed(4)},${p.lat.toFixed(4)}`).join("\n");
      await onSave?.({ name: fileName, tag: fileTag, mode, values, coordinates, waypoints: waypointStr });
      setSavedState({ name: fileName, tag: fileTag, mode, values: { ...values }, coordinates });
      setIsSaving(false);
      setSaveSuccess(true);
      setTriedSave(false);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("WMM save failed:", err);
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
    setCoordinates("");
    setTriedSave(false);
  };

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
          <h3 className={cn("text-sm font-bold transition-colors", hasChanges ? "text-red-500" : "text-[#CCFF00]")}>WMM Geomagnetic Model</h3>
          {!readOnly && (!isExisting || !locked) && (
            <button onClick={handleSave} className="cursor-none text-[#CCFF00]" title="Save">
              <SuccessIcon size={22} />
            </button>
          )}
          {isExisting && !readOnly && (
            <LockIcon locked={locked} onToggle={handleToggleLock} size={22} />
          )}
          <UnsavedChanges
            open={isSaving || saveSuccess || saveError}
            isSaving={isSaving}
            success={saveSuccess}
            error={saveError}
            hideReset
            savingLabel="Saving…"
            successLabel="Changes saved"
            errorLabel={!hasCoords ? "Coordinates required" : !canSave ? "Fill all required fields" : "Save failed"}
          />
        </div>
        <div className="flex items-center">
          {!locked && (
            <button onClick={handleClear} className="text-[11px] font-bold text-red-500 hover:text-red-400 transition-colors cursor-none">
              Clear
            </button>
          )}
        </div>
      </div>

      {/* File name + tag */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-[#CCFF00] font-bold">File Name</span>
          <input type="text" value={fileName} onChange={(e) => setFileName(e.target.value)} disabled={locked}
            placeholder="e.g. North Sea WMM"
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

      {/* Grid mode: editable coordinate fields + other params */}
      {mode === "grid" && (
        <div className="space-y-4 mb-4">
          <div className="grid grid-cols-4 gap-4">
            {[
              { key: "lon0", label: "Lon Min", unit: "°" },
              { key: "lon1", label: "Lon Max", unit: "°" },
              { key: "lat0", label: "Lat Min", unit: "°" },
              { key: "lat1", label: "Lat Max", unit: "°" },
            ].map((f) => (
              <ParamField
                key={f.key}
                param={{ key: f.key, label: f.label, unit: f.unit, default: 0 }}
                value={bbox ? String(f.key === "lon0" ? bbox.lonMin : f.key === "lon1" ? bbox.lonMax : f.key === "lat0" ? bbox.latMin : bbox.latMax) : (values[f.key] ?? "")}
                onChange={(val) => {
                  const num = parseFloat(val);
                  if (!isNaN(num) && bbox) {
                    const newBBox = { ...bbox };
                    if (f.key === "lon0") newBBox.lonMin = num;
                    else if (f.key === "lon1") newBBox.lonMax = num;
                    else if (f.key === "lat0") newBBox.latMin = num;
                    else newBBox.latMax = num;
                    setBBox(newBBox);
                    mapHandleRef.current?.drawBBox(newBBox);
                  } else if (!isNaN(num) && !bbox) {
                    updateValue(f.key, val);
                    // Try to construct bbox from all 4 values
                    const v = { ...values, [f.key]: val };
                    const lon0 = parseFloat(v.lon0 ?? "");
                    const lon1 = parseFloat(v.lon1 ?? "");
                    const lat0 = parseFloat(v.lat0 ?? "");
                    const lat1 = parseFloat(v.lat1 ?? "");
                    if (!isNaN(lon0) && !isNaN(lon1) && !isNaN(lat0) && !isNaN(lat1)) {
                      const newBBox = { lonMin: lon0, lonMax: lon1, latMin: lat0, latMax: lat1 };
                      setBBox(newBBox);
                      mapHandleRef.current?.drawBBox(newBBox);
                    }
                  } else {
                    updateValue(f.key, val);
                  }
                }}
                disabled={locked}
                error={triedSave && !bbox}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {activeParams.map((param) => (
              <ParamField key={param.key} param={param} value={values[param.key]} onChange={(val) => updateValue(param.key, val)}
                disabled={locked} error={triedSave && (emptyRequired.has(param.key) || invalidNumbers.has(param.key))}
              />
            ))}
          </div>
        </div>
      )}

      {/* Line mode: just the params */}
      {mode === "line" && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          {activeParams.map((param) => (
            <ParamField key={param.key} param={param} value={values[param.key]} onChange={(val) => updateValue(param.key, val)}
              disabled={locked} error={triedSave && (emptyRequired.has(param.key) || invalidNumbers.has(param.key))}
            />
          ))}
        </div>
      )}

      {/* Map */}
      <div id="wmm-map-container">
        <WMMMap
          ref={mapHandleRef}
          mode={mode}
          disabled={locked}
          initialBBox={savedBBox ?? undefined}
          initialLine={savedLine.length > 0 ? savedLine : undefined}
          onBBoxChange={(b) => { setBBox(b); setCaptured(false); }}
          onLineChange={(pts) => { setLinePoints(pts); setCaptured(false); }}
          onWaypointDragStart={() => {
            // Old interpolation is now invalid
            setCaptured(false);
            setCapturedCoords(null);
            setCoordinates("");
          }}
          onClear={() => {
            setBBox(null);
            setLinePoints([]);
            setCapturedCoords(null);
            setCaptured(false);
            // Clear coordinate values
            updateValue("lon0", "");
            updateValue("lon1", "");
            updateValue("lat0", "");
            updateValue("lat1", "");
            setCoordinates("");
            setCaptured(false);
          }}
          className="w-full h-[360px] border border-[#222] rounded-lg"
        />
      </div>

      {/* Capture / Save Coordinates button */}
      <div className="flex items-center justify-between mt-4">
        <CaptureButton
          disabled={locked || (mode === "grid" ? !bbox : linePoints.length < 2)}
          onCapture={async () => {
            if (captured) {
              // "Save Coordinates" mode — collect all points (green + red) and store
              const allCoords: { lon: number; lat: number }[] = [];
              if (capturedCoords) allCoords.push(...capturedCoords);
              setCoordinates(allCoords.map((c) => `${c.lon},${c.lat}`).join("\n"));
              setCaptured(false);
              return;
            }

            // "Capture" mode
            if (mode === "grid" && bbox) {
              setCapturedCoords([
                { lon: +bbox.lonMin.toFixed(4), lat: +bbox.latMin.toFixed(4) },
                { lon: +bbox.lonMax.toFixed(4), lat: +bbox.latMin.toFixed(4) },
                { lon: +bbox.lonMax.toFixed(4), lat: +bbox.latMax.toFixed(4) },
                { lon: +bbox.lonMin.toFixed(4), lat: +bbox.latMax.toFixed(4) },
              ]);
              updateValue("lon0", bbox.lonMin.toFixed(4));
              updateValue("lon1", bbox.lonMax.toFixed(4));
              updateValue("lat0", bbox.latMin.toFixed(4));
              updateValue("lat1", bbox.latMax.toFixed(4));
              setCaptured(true);
            } else if (mode === "line") {
              // Calculate interpolation points
              let nPts = parseInt(values["n_points"] || "200", 10);

              if (isTeam) {
                // Enforce 1 point per 5 km
                const maxPts = maxTeamPoints(linePoints);
                nPts = Math.min(nPts, maxPts);
                updateValue("n_points", String(nPts));
              } else if (nPts > 100) {
                console.warn("Warning: >100 interpolation points — this may take time");
              }

              const interpPts = interpolateLinePoints(linePoints, nPts);

              // Show red dots on map
              mapHandleRef.current?.showInterpolatedPoints(interpPts);

              // Build full coordinate list: green waypoints + red interpolated
              const waypointCoords = linePoints.map((p) => ({ lon: +p.lng.toFixed(4), lat: +p.lat.toFixed(4) }));
              const interpCoords = interpPts.map((p) => ({ lon: +p.lng.toFixed(4), lat: +p.lat.toFixed(4) }));
              const allCoords = [...waypointCoords, ...interpCoords].sort((a, b) => {
                // Sort by order along the line — approximate by combining both
                return 0; // Keep original order for now
              });

              // Interleave: waypoints are green, interp are red — show all in table
              setCapturedCoords([...waypointCoords, ...interpCoords]);
              setCoordinates([...waypointCoords, ...interpCoords].map((c) => `${c.lon},${c.lat}`).join("\n"));
              setCaptured(true);
            }
          }}
          text={captured ? "Save Coordinates" : "Capture"}
          workingText="Interpolating..."
          successText={captured ? "Saved" : "Captured"}
          minDuration={captured ? 1000 : 5000}
        />

        {/* Info */}
        <div className="flex items-center gap-3">
          {mode === "line" && linePoints.length > 0 && (
            <span className="text-[10px] text-[#555]">
              {linePoints.length} waypoint{linePoints.length !== 1 ? "s" : ""}
              {linePoints.length >= 2 && ` · ${totalLineKm(linePoints).toFixed(1)} km`}
              {isTeam && linePoints.length >= 2 && ` · max ${maxTeamPoints(linePoints)} pts`}
            </span>
          )}
        </div>
      </div>

      {/* Grid mode: show captured bbox coordinates */}
      {mode === "grid" && capturedCoords && capturedCoords.length > 0 && (
        <div className="mt-4 border border-[#1a1a1a] rounded-lg overflow-hidden">
          <div className="grid grid-cols-2 gap-0">
            {[
              { label: "SW (Min)", coord: capturedCoords[0] },
              { label: "SE", coord: capturedCoords[1] },
              { label: "NE (Max)", coord: capturedCoords[2] },
              { label: "NW", coord: capturedCoords[3] },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-r border-[#1a1a1a] last:border-r-0">
                <span className="text-[10px] text-[#CCFF00] font-bold">{item.label}</span>
                <span className="text-[11px] text-white font-mono">
                  {item.coord.lon}°, {item.coord.lat}°
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

/** Parse coordinates string back into LinePoint array */
function parseLineFromCoords(coordStr: string): LinePoint[] {
  if (!coordStr) return [];
  return coordStr.split("\n").filter(Boolean).map((line) => {
    const [lng, lat] = line.split(",").map(Number);
    return { lng, lat };
  });
}
