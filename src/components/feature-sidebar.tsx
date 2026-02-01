"use client";

import { useState } from "react";
import { Feature, File as DbFile, Task } from "@/db/schema";
import { Button } from "./ui/button";
import { FeatureCard } from "./feature-card";
import { FeatureDialog } from "./feature-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Layers,
  FileText,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureSidebarProps {
  projectId: string | null;
  features: Feature[];
  files: DbFile[];
  tasks: Task[];
  selectedFeatureId: string | null;
  onSelectFeature: (featureId: string | null) => void;
  onFileClick: (file: DbFile) => void;
  onRefresh: () => void;
}

export function FeatureSidebar({
  projectId,
  features,
  files,
  tasks,
  selectedFeatureId,
  onSelectFeature,
  onFileClick,
  onRefresh,
}: FeatureSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState<Feature | null>(null);

  function getFilesForFeature(featureId: string) {
    return files.filter((f) => f.featureId === featureId);
  }

  function getProjectLevelFiles() {
    return files.filter((f) => f.projectId && !f.featureId && !f.taskId);
  }

  function getTaskCountForFeature(featureId: string) {
    return tasks.filter((t) => t.featureId === featureId).length;
  }

  async function handleDeleteFeature(feature: Feature) {
    const taskCount = getTaskCountForFeature(feature.id);
    const message = taskCount > 0
      ? `Delete "${feature.name}" and unlink its ${taskCount} task(s)?`
      : `Delete "${feature.name}"?`;

    if (!confirm(message)) return;

    try {
      await fetch(`/api/features/${feature.id}`, { method: "DELETE" });
      if (selectedFeatureId === feature.id) {
        onSelectFeature(null);
      }
      onRefresh();
    } catch (error) {
      console.error("Failed to delete feature:", error);
    }
  }

  async function handleCreateFile(featureId?: string) {
    const name = prompt("Enter file name (e.g., planning.md):");
    if (!name) return;

    try {
      await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: featureId ? undefined : projectId,
          featureId: featureId || undefined,
          name,
          type: name.endsWith(".md") ? "markdown" : "other",
          content: "",
        }),
      });
      onRefresh();
    } catch (error) {
      console.error("Failed to create file:", error);
    }
  }

  async function handleDeleteFile(file: DbFile) {
    if (!confirm(`Delete "${file.name}"?`)) return;

    try {
      await fetch(`/api/files/${file.id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Failed to delete file:", error);
    }
  }

  if (!projectId) {
    return null;
  }

  if (isCollapsed) {
    return (
      <div className="w-10 border-r-4 border-black bg-white flex flex-col items-center py-4">
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 hover:bg-gray-100 border-2 border-black"
          title="Expand sidebar"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-4 writing-mode-vertical text-xs font-bold uppercase tracking-widest text-gray-500">
          Features
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-64 border-r-4 border-black bg-white flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-3 border-b-2 border-black bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            <span className="font-bold text-sm uppercase">Features</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setEditingFeature(null);
                setIsDialogOpen(true);
              }}
              className="p-1.5 hover:bg-gray-200 border-2 border-black"
              title="Add feature"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => setIsCollapsed(true)}
              className="p-1.5 hover:bg-gray-200"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Feature list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {/* All Tasks option */}
          <button
            onClick={() => onSelectFeature(null)}
            className={cn(
              "w-full text-left px-3 py-2 font-bold text-sm border-2 border-black transition-colors",
              selectedFeatureId === null
                ? "bg-black text-white"
                : "bg-white hover:bg-gray-100"
            )}
          >
            All Tasks
            <span className="ml-2 text-xs opacity-70">
              ({tasks.length})
            </span>
          </button>

          {/* Project-level files */}
          <div className="border-2 border-black bg-gray-50 p-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase text-gray-600">Project Files</span>
              <button
                onClick={() => handleCreateFile()}
                className="p-1 hover:bg-gray-200"
                title="Add project file"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            {getProjectLevelFiles().length > 0 ? (
              <div className="space-y-1">
                {getProjectLevelFiles().map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 group"
                  >
                    <button
                      onClick={() => onFileClick(file)}
                      className="flex-1 text-left text-xs px-2 py-1 hover:bg-white border border-transparent hover:border-black truncate flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3 flex-shrink-0" />
                      {file.name}
                    </button>
                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600"
                      title="Delete file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-gray-400 text-center py-1">
                No files yet
              </div>
            )}
          </div>

          {/* Features */}
          {features.map((feature) => (
            <FeatureCard
              key={feature.id}
              feature={feature}
              files={getFilesForFeature(feature.id)}
              taskCount={getTaskCountForFeature(feature.id)}
              isSelected={selectedFeatureId === feature.id}
              onSelect={() => onSelectFeature(feature.id)}
              onEdit={() => {
                setEditingFeature(feature);
                setIsDialogOpen(true);
              }}
              onDelete={() => handleDeleteFeature(feature)}
              onFileClick={onFileClick}
              onCreateFile={() => handleCreateFile(feature.id)}
              onDeleteFile={handleDeleteFile}
            />
          ))}

          {features.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-4">
              No features yet
            </div>
          )}
        </div>
      </div>

      <FeatureDialog
        feature={editingFeature}
        projectId={projectId}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={onRefresh}
      />
    </>
  );
}
