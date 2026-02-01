"use client";

import { useState } from "react";
import { Feature, File as DbFile } from "@/db/schema";
import { ChevronDown, ChevronRight, Edit, Trash2, Plus } from "lucide-react";
import { FileList } from "./file-list";
import { cn } from "@/lib/utils";

interface FeatureCardProps {
  feature: Feature;
  files: DbFile[];
  taskCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFileClick: (file: DbFile) => void;
  onCreateFile: () => void;
  onDeleteFile: (file: DbFile) => void;
}

const statusColors = {
  planning: "bg-gray-200",
  in_progress: "bg-[--color-secondary]",
  completed: "bg-[--color-success]",
};

export function FeatureCard({
  feature,
  files,
  taskCount,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  onFileClick,
  onCreateFile,
  onDeleteFile,
}: FeatureCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={cn(
        "border-2 border-black transition-colors",
        isSelected ? "bg-[--color-primary]" : "bg-white hover:bg-gray-50"
      )}
    >
      {/* Feature header */}
      <div className="flex items-center">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-2 hover:bg-black/10"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={onSelect}
          className="flex-1 flex items-center gap-2 py-2 pr-2 text-left"
        >
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              statusColors[feature.status as keyof typeof statusColors]
            )}
          />
          <span className="font-bold text-sm truncate">{feature.name}</span>
          <span className="text-xs opacity-70">({taskCount})</span>
        </button>

        <div className="flex items-center pr-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1.5 hover:bg-black/10"
            title="Edit feature"
          >
            <Edit className="h-3 w-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 hover:bg-red-100 hover:text-red-600"
            title="Delete feature"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Expanded content - Files */}
      {isExpanded && (
        <div className="border-t border-black/20 bg-white/50 px-2 py-2">
          <div className="text-xs font-bold uppercase text-gray-600 mb-1 px-2">
            Files
          </div>
          <FileList
            files={files}
            onFileClick={onFileClick}
            onCreateFile={onCreateFile}
            onDeleteFile={onDeleteFile}
            showCreateButton
          />
        </div>
      )}
    </div>
  );
}
