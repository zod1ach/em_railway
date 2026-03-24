/**
 * Individual workflow node card with typed ports and status indicator.
 */

import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import type { WorkflowNodeInstance } from "@/types/workflow-nodes";
import { PORT_COLORS, type PortDef } from "@/types/workflow-nodes";
import type { WorkflowNodeDef } from "@/types/workflow-nodes";
import * as Icons from "lucide-react";

const NODE_WIDTH_SINGLE = 100;
const NODE_WIDTH_BATCH = 140;
const NODE_WIDTH_BATCH_DC = 150;

/* ── Color map ── */
const colorClasses: Record<string, string> = {
  rose:    "border-rose-400/40 bg-rose-400/10 text-rose-400",
  yellow:  "border-yellow-400/40 bg-yellow-400/10 text-yellow-400",
  purple:  "border-purple-400/40 bg-purple-400/10 text-purple-400",
  lime:    "border-lime-400/40 bg-lime-400/10 text-lime-400",
  emerald: "border-emerald-400/40 bg-emerald-400/10 text-emerald-400",
  blue:    "border-blue-400/40 bg-blue-400/10 text-blue-400",
  cyan:    "border-cyan-400/40 bg-cyan-400/10 text-cyan-400",
  amber:   "border-amber-400/40 bg-amber-400/10 text-amber-400",
  red:     "border-red-400/40 bg-red-400/10 text-red-400",
  indigo:  "border-indigo-400/40 bg-indigo-400/10 text-indigo-400",
  violet:  "border-violet-400/40 bg-violet-400/10 text-violet-400",
  sky:     "border-sky-400/40 bg-sky-400/10 text-sky-400",
  pink:    "border-pink-400/40 bg-pink-400/10 text-pink-400",
  teal:    "border-teal-400/40 bg-teal-400/10 text-teal-400",
  gray:    "border-gray-400/40 bg-gray-400/10 text-gray-400",
  white:   "border-white/60 bg-white/10 text-white",
};

/* ── Glow shadows per color ── */
const glowShadows: Record<string, string> = {
  rose:    "0 0 12px 2px rgba(251,113,133,0.45)",
  yellow:  "0 0 12px 2px rgba(250,204,21,0.45)",
  purple:  "0 0 12px 2px rgba(192,132,252,0.45)",
  lime:    "0 0 12px 2px rgba(163,230,53,0.45)",
  emerald: "0 0 12px 2px rgba(52,211,153,0.45)",
  blue:    "0 0 12px 2px rgba(96,165,250,0.45)",
  cyan:    "0 0 12px 2px rgba(34,211,238,0.45)",
  amber:   "0 0 12px 2px rgba(251,191,36,0.45)",
  red:     "0 0 12px 2px rgba(248,113,113,0.45)",
  indigo:  "0 0 12px 2px rgba(129,140,248,0.45)",
  violet:  "0 0 12px 2px rgba(167,139,250,0.45)",
  sky:     "0 0 12px 2px rgba(56,189,248,0.45)",
  pink:    "0 0 12px 2px rgba(244,114,182,0.45)",
  teal:    "0 0 12px 2px rgba(45,212,191,0.45)",
  gray:    "0 0 12px 2px rgba(156,163,175,0.45)",
  white:   "0 0 12px 2px rgba(255,255,255,0.45)",
};

/* ── Status indicator ── */
const statusColors: Record<string, string> = {
  idle:    "bg-[#333]",
  running: "bg-amber-500 animate-pulse",
  done:    "bg-emerald-500",
  error:   "bg-red-500",
};

/* ── Resolve lucide icon by name ── */
function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string }>;
  }
  return Icons.CircleDot;
}

/* ── Port dot ── */
function PortDot({
  port,
  side,
  index,
  total,
  onMouseDown,
  onMouseUp,
}: {
  port: PortDef;
  side: "left" | "right";
  index: number;
  total: number;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
}) {
  const spacing = 100 / (total + 1);
  const topPercent = spacing * (index + 1);

  return (
    <div
      className="absolute z-30 flex h-2.5 w-2.5 cursor-crosshair items-center justify-center"
      style={{
        top: `${topPercent}%`,
        ...(side === "left" ? { left: -4 } : { right: -4 }),
        transform: "translateY(-50%)",
      }}
      title={`${port.name} (${port.type})`}
      onMouseDown={(e) => { e.stopPropagation(); onMouseDown?.(); }}
      onMouseUp={(e) => { e.stopPropagation(); onMouseUp?.(); }}
    >
      <div
        className="h-1.5 w-1.5 rounded-full border border-[#333] transition-transform hover:scale-150"
        style={{ backgroundColor: PORT_COLORS[port.type] }}
      />
    </div>
  );
}

/* ── Props ── */
interface WorkflowNodeCardProps {
  node: WorkflowNodeInstance;
  def: WorkflowNodeDef;
  isDragging: boolean;
  isSelected: boolean;
  onClick: () => void;
  onPortDragStart: (portId: string) => void;
  onPortDragEnd: (portId: string) => void;
  onToggleMagnetic?: (nodeId: string) => void;
}

export function WorkflowNodeCard({
  node,
  def,
  isDragging,
  isSelected,
  onClick,
  onPortDragStart,
  onPortDragEnd,
  onToggleMagnetic,
}: WorkflowNodeCardProps) {
  const Icon = getIcon(def.iconName);
  const cls = colorClasses[def.color] ?? colorClasses.gray;
  const inputPorts = def.ports.filter((p) => p.direction === "in");
  const outputPorts = def.ports.filter((p) => p.direction === "out");
  const isHvac = node.defType === "hvac-file";
  const isWmm = node.defType === "wmm-file";
  const isMagnetic = !!node.config.magnetic;
  const wmmMode = String(node.config.wmmMode ?? "");
  const isBatchNode = node.defType.startsWith("batch-");

  // Dynamic title for WMM nodes
  const displayTitle = isWmm && wmmMode
    ? `WMM (${wmmMode === "line" ? "L" : "G"})`
    : def.title;

  return (
    <div
      className="relative"
      style={{ width: getNodeWidth(node.defType), height: NODE_HEIGHT }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      {/* Input ports — left edge */}
      {inputPorts.map((p, i) => (
        <PortDot
          key={p.id}
          port={p}
          side="left"
          index={i}
          total={inputPorts.length}
          onMouseUp={() => onPortDragEnd(p.id)}
        />
      ))}

      {/* Output ports — right edge */}
      {outputPorts.map((p, i) => (
        <PortDot
          key={p.id}
          port={p}
          side="right"
          index={i}
          total={outputPorts.length}
          onMouseDown={() => onPortDragStart(p.id)}
        />
      ))}

      <div
        className={`group/node relative flex h-full w-full items-center overflow-hidden rounded ${isBatchNode ? "border-2" : "border"} ${cls} bg-[#0d0d0d]/70 px-2 backdrop-blur transition-all hover:shadow-lg ${
          isDragging ? "shadow-xl ring-2 ring-white/20" : ""
        }`}
        style={isSelected ? { boxShadow: glowShadows[def.color] ?? glowShadows.gray } : undefined}
      >
        <div className="flex w-full items-center gap-1.5">
          <Icon className={`h-3.5 w-3.5 shrink-0 ${cls.split(" ").pop()}`} />
          <h3 className="min-w-0 flex-1 truncate text-[9px] font-medium text-white/90">
            {displayTitle}
          </h3>
          {/* Magnetic toggle — HVAC only */}
          {isHvac && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleMagnetic?.(node.id);
              }}
              className="cursor-none text-[7px] font-bold text-white uppercase leading-none"
              title={isMagnetic ? "Magnetic mode" : "Non-magnetic mode"}
            >
              {isMagnetic ? "M" : "N"}
            </button>
          )}
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusColors[node.status]}`} />
        </div>
      </div>
    </div>
  );
}

export { NODE_WIDTH_SINGLE, NODE_WIDTH_BATCH };
export const NODE_HEIGHT = 30;
export function getNodeWidth(defType: string): number {
  if (defType === "batch-dc-cable" || defType === "batch-dc-location") return NODE_WIDTH_BATCH_DC;
  if (defType.startsWith("batch-")) return NODE_WIDTH_BATCH;
  return NODE_WIDTH_SINGLE;
}
