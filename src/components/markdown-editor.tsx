"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { File as DbFile } from "@/db/schema";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { MarkdownPreview } from "./markdown-preview";
import { Save, Eye, Edit, Check } from "lucide-react";

interface MarkdownEditorProps {
  file: DbFile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function MarkdownEditor({
  file,
  open,
  onOpenChange,
  onSave,
}: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview" | "split">("split");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load file content when file changes
  useEffect(() => {
    if (file) {
      setContent(file.content || "");
      setOriginalContent(file.content || "");
      setLastSaved(null);
    }
  }, [file]);

  // Auto-save with debounce
  const autoSave = useCallback(async () => {
    if (!file || content === originalContent) return;

    setIsSaving(true);
    try {
      await fetch(`/api/files/${file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      setOriginalContent(content);
      setLastSaved(new Date());
      onSave();
    } catch (error) {
      console.error("Failed to save file:", error);
    } finally {
      setIsSaving(false);
    }
  }, [file, content, originalContent, onSave]);

  // Set up auto-save on content change
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    if (content !== originalContent) {
      saveTimeoutRef.current = setTimeout(() => {
        autoSave();
      }, 2000);
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [content, originalContent, autoSave]);

  // Manual save
  async function handleManualSave() {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    await autoSave();
  }

  const hasUnsavedChanges = content !== originalContent;

  if (!file) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b-4 border-black bg-gray-50">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              {file.name}
              {hasUnsavedChanges && (
                <span className="text-xs text-amber-600 font-normal">
                  (unsaved)
                </span>
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              {lastSaved && (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Check className="h-3 w-3 text-green-600" />
                  Saved
                </span>
              )}
              <Button
                size="sm"
                onClick={handleManualSave}
                disabled={isSaving || !hasUnsavedChanges}
                className="gap-1"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 flex flex-col min-h-0 p-4">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="flex-1 flex flex-col min-h-0"
          >
            <TabsList className="mb-4">
              <TabsTrigger value="edit" className="gap-1">
                <Edit className="h-4 w-4" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1">
                <Eye className="h-4 w-4" />
                Preview
              </TabsTrigger>
              <TabsTrigger value="split" className="gap-1">
                Split
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="flex-1 min-h-0 mt-0">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-full px-4 py-3 border-3 border-black font-mono text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] resize-none"
                placeholder="Start typing markdown..."
              />
            </TabsContent>

            <TabsContent value="preview" className="flex-1 min-h-0 mt-0 overflow-auto">
              <div className="px-4 py-3 border-3 border-black h-full overflow-auto bg-white">
                <MarkdownPreview content={content} />
              </div>
            </TabsContent>

            <TabsContent value="split" className="flex-1 min-h-0 mt-0">
              <div className="grid grid-cols-2 gap-4 h-full">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="px-4 py-3 border-3 border-black font-mono text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] resize-none"
                  placeholder="Start typing markdown..."
                />
                <div className="px-4 py-3 border-3 border-black overflow-auto bg-gray-50">
                  <MarkdownPreview content={content} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
