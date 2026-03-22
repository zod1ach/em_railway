import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { cn } from "@/lib/utils";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY ?? "";

const STYLES = {
  dark: `https://api.maptiler.com/maps/dataviz-dark/style.json?key=${MAPTILER_KEY}`,
  satellite: `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`,
  terrain: `https://api.maptiler.com/maps/outdoor-v2/style.json?key=${MAPTILER_KEY}`,
};

type MapStyle = keyof typeof STYLES;

export interface BBox {
  lonMin: number; lonMax: number; latMin: number; latMax: number;
}

export interface LinePoint {
  lng: number; lat: number;
}

export interface WMMMapHandle {
  clearDrawing: () => void;
  showInterpolatedPoints: (points: LinePoint[]) => void;
  clearInterpolatedPoints: () => void;
  drawBBox: (bbox: BBox) => void;
  placePin: (point: LinePoint) => void;
  setMarkersEnabled: (enabled: boolean) => void;
}

interface WMMMapProps {
  mode: "grid" | "line" | "pin";
  onBBoxChange?: (bbox: BBox) => void;
  onLineChange?: (points: LinePoint[]) => void;
  onPinChange?: (point: LinePoint) => void;
  onClear?: () => void;
  onWaypointDragStart?: () => void;
  initialBBox?: BBox;
  initialLine?: LinePoint[];
  initialPin?: LinePoint;
  disabled?: boolean;
  className?: string;
}

export const WMMMap = forwardRef<WMMMapHandle, WMMMapProps>(function WMMMap({
  mode, onBBoxChange, onLineChange, onPinChange, onClear, onWaypointDragStart,
  initialBBox, initialLine, initialPin, disabled = false, className,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [style, setStyle] = useState<MapStyle>("dark");
  const [mouseCoords, setMouseCoords] = useState<{ lng: number; lat: number } | null>(null);

  // Drawing refs
  const drawingBox = useRef(false);
  const boxStart = useRef<maplibregl.LngLat | null>(null);
  const boxSourceAdded = useRef(false);
  const linePoints = useRef<LinePoint[]>(initialLine ?? []);
  const waypointMarkers = useRef<maplibregl.Marker[]>([]);
  const interpMarkers = useRef<maplibregl.Marker[]>([]);
  const lineSourceAdded = useRef(false);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

  // ── Init map ──
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLES[style],
      center: [0, 50],
      zoom: 3,
      attributionControl: false,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapRef.current = map;

    map.on("mousemove", (e) => {
      setMouseCoords({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });
    map.on("mouseout", () => setMouseCoords(null));

    map.on("load", () => {
      if (mode === "grid" && initialBBox) {
        addBoxToMap(map, initialBBox);
        zoomToBBox(map, initialBBox);
      }
      if (mode === "line" && initialLine?.length) {
        initialLine.forEach((pt) => addWaypointMarker(map, pt));
        updateLineOnMap(map);
        zoomToPoints(map, initialLine);
      }
      if (mode === "pin" && initialPin) {
        placePin(map, initialPin);
        map.flyTo({ center: [initialPin.lng, initialPin.lat], zoom: 6, duration: 1000 });
      }
    });

    return () => {
      waypointMarkers.current.forEach((m) => m.remove());
      interpMarkers.current.forEach((m) => m.remove());
      pinMarkerRef.current?.remove();
      waypointMarkers.current = [];
      interpMarkers.current = [];
      map.remove();
      mapRef.current = null;
      boxSourceAdded.current = false;
      lineSourceAdded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Style changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(STYLES[style]);
  }, [style]);

  // ── Grid mode ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "grid" || disabled) return;

    const onDown = (e: maplibregl.MapMouseEvent) => {
      drawingBox.current = true;
      boxStart.current = e.lngLat;
      map.getCanvas().style.cursor = "crosshair";
    };
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (!drawingBox.current || !boxStart.current) return;
      addBoxToMap(map, makeBBox(boxStart.current, e.lngLat));
    };
    const onUp = (e: maplibregl.MapMouseEvent) => {
      if (!drawingBox.current || !boxStart.current) return;
      drawingBox.current = false;
      map.getCanvas().style.cursor = "";
      const bbox = makeBBox(boxStart.current, e.lngLat);
      addBoxToMap(map, bbox);
      onBBoxChange?.(bbox);
      boxStart.current = null;
    };

    map.on("mousedown", onDown);
    map.on("mousemove", onMove);
    map.on("mouseup", onUp);
    map.dragPan.disable();

    return () => {
      map.off("mousedown", onDown);
      map.off("mousemove", onMove);
      map.off("mouseup", onUp);
      map.dragPan.enable();
    };
  }, [mode, disabled, onBBoxChange]);

  // ── Line mode ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "line" || disabled) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const pt: LinePoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      linePoints.current = [...linePoints.current, pt];
      addWaypointMarker(map, pt);
      updateLineOnMap(map);
      onLineChange?.([...linePoints.current]);
    };

    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => { map.off("click", onClick); map.getCanvas().style.cursor = ""; };
  }, [mode, disabled, onLineChange]);

  // ── Pin mode: click to place single pin ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || mode !== "pin" || disabled) return;

    const onClick = (e: maplibregl.MapMouseEvent) => {
      const pt: LinePoint = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      placePin(map, pt);
      onPinChange?.(pt);
    };

    map.on("click", onClick);
    map.getCanvas().style.cursor = "crosshair";
    return () => { map.off("click", onClick); map.getCanvas().style.cursor = ""; };
  }, [mode, disabled, onPinChange]);

  // ── Imperative handle ──
  useImperativeHandle(ref, () => ({
    clearDrawing: () => clearAll(),
    showInterpolatedPoints: (pts) => showInterpDots(pts),
    drawBBox: (b: BBox) => {
      const map = mapRef.current;
      if (!map) return;
      addBoxToMap(map, b);
      zoomToBBox(map, b);
    },
    placePin: (pt: LinePoint) => {
      const map = mapRef.current;
      if (!map) return;
      placePin(map, pt);
      map.flyTo({ center: [pt.lng, pt.lat], zoom: 6, duration: 1000 });
    },
    clearInterpolatedPoints: () => clearInterpDots(),
    setMarkersEnabled: (enabled: boolean) => {
      waypointMarkers.current.forEach((m) => {
        m.setDraggable(enabled);
        const el = m.getElement();
        el.style.setProperty("cursor", enabled ? "pointer" : "default", "important");
        if (enabled) {
          el.onmouseenter = () => { el.style.background = "#3b82f6"; el.style.setProperty("cursor", "grab", "important"); };
          el.onmouseleave = () => { el.style.background = "#22c55e"; el.style.setProperty("cursor", "pointer", "important"); };
        } else {
          el.onmouseenter = null;
          el.onmouseleave = null;
        }
      });
    },
  }));

  // ── Helpers ──
  function placePin(map: maplibregl.Map, pt: LinePoint) {
    // Remove previous pin
    pinMarkerRef.current?.remove();
    const el = document.createElement("div");
    Object.assign(el.style, { width: "14px", height: "14px", borderRadius: "50%", background: "#CCFF00", border: "3px solid #0d0d0d" });
    el.style.setProperty("cursor", "pointer", "important");
    pinMarkerRef.current = new maplibregl.Marker({ element: el }).setLngLat([pt.lng, pt.lat]).addTo(map);
  }

  function makeBBox(a: maplibregl.LngLat, b: maplibregl.LngLat): BBox {
    return {
      lonMin: Math.min(a.lng, b.lng), lonMax: Math.max(a.lng, b.lng),
      latMin: Math.min(a.lat, b.lat), latMax: Math.max(a.lat, b.lat),
    };
  }

  function zoomToBBox(map: maplibregl.Map, bbox: BBox) {
    map.fitBounds([[bbox.lonMin, bbox.latMin], [bbox.lonMax, bbox.latMax]], { padding: 60, duration: 1000 });
  }

  function zoomToPoints(map: maplibregl.Map, pts: LinePoint[]) {
    if (!pts.length) return;
    const bounds = new maplibregl.LngLatBounds();
    pts.forEach((p) => bounds.extend([p.lng, p.lat]));
    map.fitBounds(bounds, { padding: 60, duration: 1000 });
  }

  function addBoxToMap(map: maplibregl.Map, bbox: BBox) {
    const coords: [number, number][] = [
      [bbox.lonMin, bbox.latMin], [bbox.lonMax, bbox.latMin],
      [bbox.lonMax, bbox.latMax], [bbox.lonMin, bbox.latMax], [bbox.lonMin, bbox.latMin],
    ];
    const geojson: GeoJSON.Feature = { type: "Feature", geometry: { type: "Polygon", coordinates: [coords] }, properties: {} };

    if (boxSourceAdded.current && map.getSource("bbox")) {
      (map.getSource("bbox") as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      if (map.getSource("bbox")) map.removeSource("bbox");
      map.addSource("bbox", { type: "geojson", data: geojson });
      map.addLayer({ id: "bbox-fill", type: "fill", source: "bbox", paint: { "fill-color": "#CCFF00", "fill-opacity": 0.1 } });
      map.addLayer({ id: "bbox-line", type: "line", source: "bbox", paint: { "line-color": "#CCFF00", "line-width": 2 } });
      boxSourceAdded.current = true;
    }
  }

  function addWaypointMarker(map: maplibregl.Map, pt: LinePoint) {
    const el = document.createElement("div");
    Object.assign(el.style, { width: "20px", height: "20px", borderRadius: "50%", background: "#22c55e", border: "3px solid #0d0d0d", transition: "background 0.15s", zIndex: "10" });
    el.style.setProperty("cursor", disabled ? "default" : "pointer", "important");

    const marker = new maplibregl.Marker({ element: el, draggable: !disabled }).setLngLat([pt.lng, pt.lat]).addTo(map);

    if (!disabled) {
      el.addEventListener("mouseenter", () => {
        el.style.background = "#3b82f6";
        el.style.setProperty("cursor", "grab", "important");
      });
      el.addEventListener("mouseleave", () => {
        el.style.background = "#22c55e";
        el.style.setProperty("cursor", "pointer", "important");
      });
    }

    let dragStartFired = false;

    const updatePos = () => {
      const pos = marker.getLngLat();
      const markerIdx = waypointMarkers.current.indexOf(marker);
      if (markerIdx >= 0) {
        linePoints.current[markerIdx] = { lng: pos.lng, lat: pos.lat };
      }
      updateLineOnMap(map);
    };

    marker.on("dragstart", () => {
      if (!dragStartFired && interpMarkers.current.length > 0) {
        dragStartFired = true;
        // Clear old interpolated points — they're now invalid
        clearInterpDots();
        onWaypointDragStart?.();
      }
    });

    marker.on("drag", updatePos);
    marker.on("dragend", () => {
      dragStartFired = false;
      updatePos();
      onLineChange?.([...linePoints.current]);
    });

    waypointMarkers.current.push(marker);
  }

  function updateLineOnMap(map: maplibregl.Map) {
    if (linePoints.current.length < 2) return;
    const coords: [number, number][] = linePoints.current.map((p) => [p.lng, p.lat]);
    const geojson: GeoJSON.Feature = { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} };

    if (lineSourceAdded.current && map.getSource("line")) {
      (map.getSource("line") as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      if (map.getSource("line")) map.removeSource("line");
      map.addSource("line", { type: "geojson", data: geojson });
      map.addLayer({ id: "line-layer", type: "line", source: "line", paint: { "line-color": "#CCFF00", "line-width": 2.5 } });
      lineSourceAdded.current = true;
    }
  }

  function showInterpDots(pts: LinePoint[]) {
    const map = mapRef.current;
    if (!map) return;
    clearInterpDots();
    pts.forEach((pt) => {
      const el = document.createElement("div");
      Object.assign(el.style, { width: "14px", height: "14px", borderRadius: "50%", background: "#ef4444", border: "2px solid #0d0d0d", transition: "background 0.15s", zIndex: "5" });
      el.style.setProperty("cursor", disabled ? "default" : "pointer", "important");

      const marker = new maplibregl.Marker({ element: el, draggable: !disabled }).setLngLat([pt.lng, pt.lat]).addTo(map);

      if (!disabled) {
        el.addEventListener("mouseenter", () => {
          el.style.background = "#3b82f6";
          el.style.setProperty("cursor", "grab", "important");
        });
        el.addEventListener("mouseleave", () => {
          el.style.background = "#ef4444";
          el.style.setProperty("cursor", "pointer", "important");
        });
      }

      marker.on("drag", () => {
        updateFullLine(map);
      });

      marker.on("dragend", () => {
        updateFullLine(map);
      });

      interpMarkers.current.push(marker);
    });
  }

  /** Rebuild line from all markers (waypoints + interp) in order along the path */
  function updateFullLine(map: maplibregl.Map) {
    // Collect all marker positions
    const allPoints: { lng: number; lat: number; fromWaypoint: boolean; origIdx: number }[] = [];

    waypointMarkers.current.forEach((m, i) => {
      const pos = m.getLngLat();
      allPoints.push({ lng: pos.lng, lat: pos.lat, fromWaypoint: true, origIdx: i });
    });

    interpMarkers.current.forEach((m) => {
      const pos = m.getLngLat();
      allPoints.push({ lng: pos.lng, lat: pos.lat, fromWaypoint: false, origIdx: -1 });
    });

    if (allPoints.length < 2) return;

    // Sort by proximity to the original waypoint path
    // Use the waypoint order as anchors, insert interp points between them
    const wpPositions = waypointMarkers.current.map((m) => m.getLngLat());
    const ordered: { lng: number; lat: number }[] = [];

    // For each segment between consecutive waypoints, collect interp points in that segment
    for (let i = 0; i < wpPositions.length; i++) {
      ordered.push({ lng: wpPositions[i].lng, lat: wpPositions[i].lat });

      if (i < wpPositions.length - 1) {
        const segStart = wpPositions[i];
        const segEnd = wpPositions[i + 1];
        const segLen = Math.sqrt((segEnd.lng - segStart.lng) ** 2 + (segEnd.lat - segStart.lat) ** 2);

        // Find interp points closest to this segment
        const interpInSeg = interpMarkers.current
          .map((m) => {
            const pos = m.getLngLat();
            // Project onto segment to get parameter t
            const dx = segEnd.lng - segStart.lng;
            const dy = segEnd.lat - segStart.lat;
            const t = segLen > 0 ? ((pos.lng - segStart.lng) * dx + (pos.lat - segStart.lat) * dy) / (segLen * segLen) : 0;
            return { lng: pos.lng, lat: pos.lat, t };
          })
          .filter((p) => p.t > 0.01 && p.t < 0.99) // Only points within this segment
          .sort((a, b) => a.t - b.t);

        interpInSeg.forEach((p) => ordered.push({ lng: p.lng, lat: p.lat }));
      }
    }

    const coords: [number, number][] = ordered.map((p) => [p.lng, p.lat]);
    const geojson: GeoJSON.Feature = { type: "Feature", geometry: { type: "LineString", coordinates: coords }, properties: {} };

    if (lineSourceAdded.current && map.getSource("line")) {
      (map.getSource("line") as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      if (map.getSource("line")) map.removeSource("line");
      map.addSource("line", { type: "geojson", data: geojson });
      map.addLayer({ id: "line-layer", type: "line", source: "line", paint: { "line-color": "#CCFF00", "line-width": 2.5 } });
      lineSourceAdded.current = true;
    }
  }

  function clearInterpDots() {
    interpMarkers.current.forEach((m) => m.remove());
    interpMarkers.current = [];
  }

  function clearAll() {
    const map = mapRef.current;
    if (!map) return;
    if (map.getLayer("bbox-fill")) map.removeLayer("bbox-fill");
    if (map.getLayer("bbox-line")) map.removeLayer("bbox-line");
    if (map.getSource("bbox")) map.removeSource("bbox");
    boxSourceAdded.current = false;
    if (map.getLayer("line-layer")) map.removeLayer("line-layer");
    if (map.getSource("line")) map.removeSource("line");
    lineSourceAdded.current = false;
    waypointMarkers.current.forEach((m) => m.remove());
    waypointMarkers.current = [];
    clearInterpDots();
    linePoints.current = [];
    onClear?.();
  }

  return (
    <div
      className={cn("relative rounded-lg overflow-hidden !cursor-crosshair [&_*]:!cursor-crosshair", className)}
      onMouseEnter={() => document.body.classList.add("hide-magnetic-cursor")}
      onMouseLeave={() => document.body.classList.remove("hide-magnetic-cursor")}
    >
      <div ref={containerRef} className="w-full h-full" />

      {/* Style toggle */}
      <div className="absolute top-2 right-2 flex gap-1 bg-[#0d0d0d]/80 rounded-lg p-1 backdrop-blur-sm">
        {(["dark", "terrain", "satellite"] as MapStyle[]).map((s) => (
          <button key={s} onClick={() => setStyle(s)}
            className={cn("px-2 py-1 text-[10px] font-bold rounded transition-colors cursor-none",
              style === s ? "bg-[#CCFF00] text-black" : "text-[#888] hover:text-white"
            )}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Hints + clear */}
      <div className="absolute bottom-2 left-2 flex items-center gap-2">
        <span className="text-[10px] text-[#888] bg-[#0d0d0d]/80 px-2 py-1 rounded backdrop-blur-sm">
          {mode === "grid" ? "Click & drag to draw box" : mode === "pin" ? "Click to place pin" : "Click to add · Hover point to drag"}
        </span>
        {!disabled && (
          <button onClick={clearAll}
            className="text-[10px] font-bold text-red-400 bg-[#0d0d0d]/80 px-2 py-1 rounded backdrop-blur-sm hover:text-red-300 transition-colors cursor-none">
            Clear
          </button>
        )}
      </div>

      {/* Mouse coordinates */}
      {mouseCoords && !disabled && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-[10px] font-mono text-[#CCFF00] bg-[#0d0d0d]/80 px-2 py-1 rounded backdrop-blur-sm">
          {mouseCoords.lat.toFixed(4)}°, {mouseCoords.lng.toFixed(4)}°
        </div>
      )}

      {disabled && (
        <div className="absolute inset-0 bg-[#0d0d0d]/50 flex items-center justify-center">
          <span className="text-xs text-[#555]">Unlock to interact</span>
        </div>
      )}
    </div>
  );
});
