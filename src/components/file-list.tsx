"use client";

import { File } from "@/db/schema";
import { FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

interface FileListProps {
  files: File[];
  onFileClick: (file: File) => void;
  onCreateFile?: () => void;
  onDeleteFile?: (file: File) => void;
  showCreateButton?: boolean;
}

export function FileList({
  files,
  onFileClick,
  onCreateFile,
  onDeleteFile,
  showCreateButton = false,
}: FileListProps) {
  if (files.length === 0 && !showCreateButton) {
    return (
      <div className="text-xs text-gray-500 italic px-2 py-1">
        No files
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div
          key={file.id}
          className="group flex items-center gap-2 px-2 py-1.5 hover:bg-gray-100 cursor-pointer text-sm"
        >
          <button
            onClick={() => onFileClick(file)}
            className="flex items-center gap-2 flex-1 text-left"
          >
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="truncate font-medium">{file.name}</span>
          </button>
          {onDeleteFile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFile(file);
              }}
              className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 hover:text-red-600 transition-opacity"
              title="Delete file"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {showCreateButton && (
        <button
          onClick={onCreateFile}
          className="flex items-center gap-2 px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-100 w-full"
        >
          <Plus className="h-4 w-4" />
          <span>Add file</span>
        </button>
      )}
    </div>
  );
}
