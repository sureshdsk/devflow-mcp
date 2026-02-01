"use client";

import { useState, useEffect } from "react";
import { Feature } from "@/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface FeatureDialogProps {
  feature?: Feature | null;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export function FeatureDialog({
  feature,
  projectId,
  open,
  onOpenChange,
  onSave,
}: FeatureDialogProps) {
  const [name, setName] = useState(feature?.name || "");
  const [description, setDescription] = useState(feature?.description || "");
  const [status, setStatus] = useState(feature?.status || "planning");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (feature) {
      setName(feature.name);
      setDescription(feature.description || "");
      setStatus(feature.status);
    } else {
      setName("");
      setDescription("");
      setStatus("planning");
    }
  }, [feature, open]);

  async function handleSave() {
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      if (feature) {
        // Update existing feature
        await fetch(`/api/features/${feature.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, description, status }),
        });
      } else {
        // Create new feature
        await fetch("/api/features", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, name, description }),
        });
      }
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save feature:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{feature ? "Edit Feature" : "New Feature"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border-3 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              placeholder="Feature name"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-3 border-black font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-h-[80px]"
              placeholder="Feature description"
            />
          </div>

          {feature && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 border-3 border-black font-bold uppercase focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <option value="planning">Planning</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t-3 border-black">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !name.trim()}>
              {isSaving ? "Saving..." : feature ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
