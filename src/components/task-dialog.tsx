"use client";

import { useState, useEffect } from "react";
import { Task, Feature } from "@/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { User, Clock } from "lucide-react";

interface TaskDialogProps {
  task: Task;
  features?: Feature[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function TaskDialog({ task, features = [], open, onOpenChange, onRefresh }: TaskDialogProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState(task.status);
  const [featureId, setFeatureId] = useState(task.featureId || "");
  const [context, setContext] = useState(task.context || "");
  const [executionPlan, setExecutionPlan] = useState(task.executionPlan || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || "");
    setPriority(task.priority);
    setStatus(task.status);
    setFeatureId(task.featureId || "");
    setContext(task.context || "");
    setExecutionPlan(task.executionPlan || "");
  }, [task]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          status,
          featureId: featureId || null,
          context,
          executionPlan,
        }),
      });
      onRefresh();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update task:", error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 border-3 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              placeholder="Task title"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 border-3 border-black font-medium focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-h-[100px]"
              placeholder="Task description"
            />
          </div>

          {/* Priority & Status Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-4 py-3 border-3 border-black font-bold uppercase focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 border-3 border-black font-bold uppercase focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="interrupted">Interrupted</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Feature */}
          {features.length > 0 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                Feature
              </label>
              <select
                value={featureId}
                onChange={(e) => setFeatureId(e.target.value)}
                className="w-full px-4 py-3 border-3 border-black font-bold focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              >
                <option value="">No Feature</option>
                {features.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Context (for AI agents) */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
              Task Context (for AI Agents)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full px-4 py-3 border-3 border-black font-mono text-sm focus:outline-none focus:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-h-[120px]"
              placeholder="Provide context, requirements, constraints, and any relevant information for AI agents working on this task..."
            />
            <p className="text-xs font-bold mt-2">
              This context will be available to AI agents via the MCP server
            </p>
          </div>

          {/* Execution Plan (set by agents) */}
          {executionPlan && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wide mb-2 block">
                Execution Plan (from Agent)
              </label>
              <div className="w-full px-4 py-3 border-3 border-black bg-gray-100 min-h-[100px] font-mono text-sm whitespace-pre-wrap">
                {executionPlan}
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap gap-3 pt-4 border-t-3 border-black">
            {task.assignedAgent && (
              <Badge variant="secondary" className="gap-1">
                <User className="h-3 w-3" />
                {task.assignedAgent}
              </Badge>
            )}
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Created: {new Date(task.createdAt).toLocaleDateString()}
            </Badge>
            {task.updatedAt && task.updatedAt !== task.createdAt && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                Updated: {new Date(task.updatedAt).toLocaleDateString()}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t-3 border-black">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
