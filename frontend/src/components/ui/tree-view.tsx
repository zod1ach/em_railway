"use client";
import React, { useState, useCallback, useRef, useEffect } from "react";
import { ChevronRight, Folder, File, FolderOpen, Plus } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

export type TreeNode = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
  data?: any;
};

export type TreeViewProps = {
  data: TreeNode[];
  className?: string;
  onNodeClick?: (node: TreeNode) => void;
  onNodeExpand?: (nodeId: string, expanded: boolean) => void;
  defaultExpandedIds?: string[];
  showLines?: boolean;
  showIcons?: boolean;
  selectable?: boolean;
  multiSelect?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  indent?: number;
  animateExpand?: boolean;
  onAddClick?: (node: TreeNode) => void;
  renderAfterAdd?: (node: TreeNode) => React.ReactNode;
  renderAfterNode?: (node: TreeNode) => React.ReactNode;
  renderLabel?: (node: TreeNode, isFolder: boolean) => React.ReactNode;
};

export function TreeView({
  data,
  className,
  onNodeClick,
  onNodeExpand,
  defaultExpandedIds = [],
  showLines = true,
  showIcons = true,
  selectable = true,
  multiSelect = false,
  selectedIds = [],
  onSelectionChange,
  indent = 20,
  animateExpand = true,
  onAddClick,
  renderAfterAdd,
  renderAfterNode,
  renderLabel,
}: TreeViewProps) {
  const treeRef = useRef<HTMLDivElement>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(defaultExpandedIds),
  );

  // Collapse all folders when clicking outside the tree
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (treeRef.current && !treeRef.current.contains(e.target as Node)) {
        setExpandedIds(new Set());
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const [internalSelectedIds, setInternalSelectedIds] =
    useState<string[]>(selectedIds);

  const isControlled =
    selectedIds !== undefined && onSelectionChange !== undefined;
  const currentSelectedIds = isControlled ? selectedIds : internalSelectedIds;

  const toggleExpanded = useCallback(
    (nodeId: string) => {
      setExpandedIds((prev) => {
        const newSet = new Set(prev);
        const isExpanded = newSet.has(nodeId);
        isExpanded ? newSet.delete(nodeId) : newSet.add(nodeId);
        onNodeExpand?.(nodeId, !isExpanded);
        return newSet;
      });
    },
    [onNodeExpand],
  );

  const handleSelection = useCallback(
    (nodeId: string, ctrlKey = false) => {
      if (!selectable) return;
      let newSelection: string[];
      if (multiSelect && ctrlKey) {
        newSelection = currentSelectedIds.includes(nodeId)
          ? currentSelectedIds.filter((id) => id !== nodeId)
          : [...currentSelectedIds, nodeId];
      } else {
        newSelection = currentSelectedIds.includes(nodeId) ? [] : [nodeId];
      }
      isControlled
        ? onSelectionChange?.(newSelection)
        : setInternalSelectedIds(newSelection);
    },
    [
      selectable,
      multiSelect,
      currentSelectedIds,
      isControlled,
      onSelectionChange,
    ],
  );

  const renderNode = (
    node: TreeNode,
    level = 0,
    isLast = false,
    parentPath: boolean[] = [],
  ) => {
    const isFolder = node.children !== undefined;
    const hasChildren = (node.children?.length ?? 0) > 0;
    const isExpanded = expandedIds.has(node.id);
    const isSelected = currentSelectedIds.includes(node.id);
    const currentPath = [...parentPath, isLast];

    const getDefaultIcon = () =>
      hasChildren ? (
        isExpanded ? (
          <FolderOpen className="h-4 w-4" />
        ) : (
          <Folder className="h-4 w-4" />
        )
      ) : (
        <File className="h-4 w-4" />
      );

    return (
      <div key={node.id} className="select-none">
        <motion.div
          className={cn(
            "flex items-center py-2 px-3 cursor-pointer transition-all duration-200 relative group rounded-md",
            "hover:bg-transparent",
            isSelected && "bg-transparent",
            selectable && "hover:border-accent-foreground/10",
          )}
          style={{ paddingLeft: level === 0 ? 0 : level * indent + 8 }}
          onClick={(e) => {
            if (hasChildren) toggleExpanded(node.id);
            handleSelection(node.id, e.ctrlKey || e.metaKey);
            onNodeClick?.(node);
          }}
          whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
        >
          {/* Tree Lines */}
          {showLines && level > 0 && (
            <div className="absolute left-0 top-0 bottom-0 pointer-events-none">
              {currentPath.map((isLastInPath, pathIndex) => (
                <div
                  key={pathIndex}
                  className="absolute top-0 bottom-0 border-l border-border/40"
                  style={{
                    left: pathIndex * indent + 12,
                    display:
                      pathIndex === currentPath.length - 1 && isLastInPath
                        ? "none"
                        : "block",
                  }}
                />
              ))}
              <div
                className="absolute top-1/2 border-t border-border/40"
                style={{
                  left: (level - 1) * indent + 12,
                  width: indent - 4,
                  transform: "translateY(-1px)",
                }}
              />
              {isLast && (
                <div
                  className="absolute top-0 border-l border-border/40"
                  style={{
                    left: (level - 1) * indent + 12,
                    height: "50%",
                  }}
                />
              )}
            </div>
          )}

          {/* Expand Icon */}
          <motion.div
            className="flex items-center justify-center w-4 h-4 mr-1"
            animate={{ rotate: hasChildren && isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
          >
            {hasChildren && (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </motion.div>

          {/* Node Icon */}
          {showIcons && (
            <motion.div
              className="flex items-center justify-center w-4 h-4 mr-2 text-muted-foreground"
              whileHover={{ scale: 1.1 }}
              transition={{ duration: 0.15 }}
            >
              {node.icon || getDefaultIcon()}
            </motion.div>
          )}

          {/* Label */}
          <span className={cn("text-sm truncate flex-1", isFolder && "group-hover:text-[#CCFF00] transition-colors")}>
            {renderLabel ? renderLabel(node, isFolder) : node.label}
          </span>

          {/* Add button for category folders only (not file nodes with batch children) */}
          {isFolder && !node.data && onAddClick && (
            <div className="flex items-center gap-0.5 ml-16">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddClick(node);
                }}
                className="p-0.5 text-[#444] hover:text-[#CCFF00] transition-colors cursor-none"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
              {renderAfterAdd?.(node)}
            </div>
          )}

          {/* Actions for non-folder nodes (files, batch folders — even if they have children) */}
          {renderAfterNode && node.data && (
            <div className="flex items-center ml-16" onClick={(e) => e.stopPropagation()}>
              {renderAfterNode(node)}
            </div>
          )}
        </motion.div>

        {/* Children */}
        <AnimatePresence>
          {hasChildren && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0, overflow: "hidden" }}
              animate={{ height: "auto", opacity: 1, overflow: "visible" }}
              exit={{ height: 0, opacity: 0, overflow: "hidden" }}
              transition={{
                duration: animateExpand ? 0.3 : 0,
                ease: "easeInOut",
              }}
            >
              <motion.div
                initial={{ y: -10 }}
                animate={{ y: 0 }}
                exit={{ y: -10 }}
                transition={{
                  duration: animateExpand ? 0.2 : 0,
                  delay: animateExpand ? 0.1 : 0,
                }}
              >
                {node.children!.map((child, index) =>
                  renderNode(
                    child,
                    level + 1,
                    index === node.children!.length - 1,
                    currentPath,
                  ),
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <motion.div
      ref={treeRef}
      className={cn(
        "w-full",
        className,
      )}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="p-0">
        {data.map((node, index) =>
          renderNode(node, 0, index === data.length - 1),
        )}
      </div>
    </motion.div>
  );
}
