/**
 * Dynamic node configuration form — renders based on WorkflowNodeDef.configFields.
 * Source nodes show a file picker dropdown populated from the project tree.
 */

import type { WorkflowNodeInstance } from "@/types/workflow-nodes";
import type { ProjectFile } from "@/types/project-files";
import { getNodeDef } from "@/lib/workflow-node-registry";
import * as Icons from "lucide-react";
import { X, Check } from "lucide-react";

/* ── Resolve icon ── */
function getIcon(name: string): React.ComponentType<{ className?: string }> {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
    return icon as React.ComponentType<{ className?: string }>;
  }
  return Icons.CircleDot;
}

/* ── Which file sub_types match each source node ── */
const SOURCE_FILE_FILTER: Record<string, string[]> = {
  "hvac-file":      ["hvac"],
  "dc-bipole-file": ["dc_bipole"],
  "wmm-file":       ["wmm_grid", "wmm_line"],
  "batch-folder":   [],  // batches handled separately
};

interface Props {
  node: WorkflowNodeInstance;
  files?: ProjectFile[];
  onUpdateConfig: (config: Record<string, string | number>) => void;
  onFileSelect?: (fileId: string) => void;
  onClose: () => void;
  onRemove: () => void;
}

export function WorkflowNodeConfig({
  node,
  files = [],
  onUpdateConfig,
  onFileSelect,
  onClose,
  onRemove,
}: Props) {
  const def = getNodeDef(node.defType);
  if (!def) return null;

  const Icon = getIcon(def.iconName);
  const fields = def.configFields ?? [];
  const isSource = def.category === "source";

  /* ── Filter files for this source node type ── */
  const allowedSubTypes = SOURCE_FILE_FILTER[node.defType] ?? [];
  const filteredFiles = files.filter((f) =>
    allowedSubTypes.includes(f.sub_type ?? "")
  );

  const selectedFileId = node.config.fileId as string | undefined;
  const selectedFile = files.find((f) => f.id === selectedFileId);
  const isFileLoaded = node.status === "done" && !!node.outputData;

  const handleFieldChange = (key: string, value: string | number) => {
    onUpdateConfig({ ...node.config, [key]: value });
  };

  return (
    <div className="rounded-lg border border-[#1a1a1a] bg-[#0d0d0d]/95 p-3 backdrop-blur-lg">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-[#888]" />
          <span className="text-xs font-semibold text-white">{def.title}</span>
          <span className="text-[9px] uppercase tracking-[0.15em] text-[#555]">{def.category}</span>
        </div>
        <button onClick={onClose} className="cursor-none text-[#555] hover:text-white">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Source node: file picker */}
      {isSource && (
        <div className="mb-2">
          <label className="mb-0.5 block text-[10px] uppercase tracking-[0.15em] text-[#666]">
            File
          </label>
          {filteredFiles.length === 0 ? (
            <p className="text-[10px] text-[#555]">
              No {allowedSubTypes.join("/")} files in project
            </p>
          ) : (
            <select
              value={selectedFileId ?? ""}
              onChange={(e) => {
                if (e.target.value) onFileSelect?.(e.target.value);
              }}
              className="w-full cursor-none rounded border border-[#222] bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-[#444]"
            >
              <option value="">Select a file...</option>
              {filteredFiles.map((f) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          )}
          {selectedFile && (
            <div className="mt-1 flex items-center gap-1.5">
              {isFileLoaded ? (
                <>
                  <Check className="h-3 w-3 text-emerald-400" />
                  <span className="text-[9px] text-emerald-400">
                    {selectedFile.name} loaded
                  </span>
                </>
              ) : (
                <span className="text-[9px] text-amber-400">Loading...</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Other config fields (non-file) */}
      {fields.filter((f) => f.type !== "file").length > 0 && (
        <div className="space-y-2">
          {fields
            .filter((f) => f.type !== "file")
            .map((field) => (
              <div key={field.key}>
                <label className="mb-0.5 block text-[10px] uppercase tracking-[0.15em] text-[#666]">
                  {field.label}
                </label>
                {field.type === "select" && field.options ? (
                  <select
                    value={(node.config[field.key] as string) ?? field.defaultValue ?? ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full cursor-none rounded border border-[#222] bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-[#444]"
                  >
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : field.type === "number" ? (
                  <input
                    type="number"
                    value={(node.config[field.key] as number) ?? field.defaultValue ?? 0}
                    onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
                    className="w-full cursor-none rounded border border-[#222] bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-[#444]"
                  />
                ) : (
                  <input
                    type="text"
                    value={(node.config[field.key] as string) ?? field.defaultValue ?? ""}
                    onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    className="w-full cursor-none rounded border border-[#222] bg-[#111] px-2 py-1.5 text-xs text-white outline-none focus:border-[#444]"
                    placeholder={field.label}
                  />
                )}
              </div>
            ))}
        </div>
      )}

      {/* No config at all */}
      {!isSource && fields.filter((f) => f.type !== "file").length === 0 && (
        <p className="text-[10px] text-[#555]">No configuration needed</p>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center justify-between border-t border-[#1a1a1a] pt-2">
        <span className="text-[9px] text-[#444]">ID: {node.id.slice(0, 12)}</span>
        <button
          onClick={onRemove}
          className="cursor-none text-[10px] uppercase tracking-[0.15em] text-red-400/60 transition-colors hover:text-red-400"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
