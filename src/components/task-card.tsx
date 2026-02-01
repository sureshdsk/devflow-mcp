"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Task, Feature } from "@/db/schema";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { GripVertical, User, FileText, Trash2, AlertTriangle } from "lucide-react";
import { TaskDialog } from "./task-dialog";
import { FeatureBadge, InterruptedBadge } from "./feature-badge";

interface TaskCardProps {
  task: Task;
  feature?: Feature | null;
  features?: Feature[];
  onRefresh: () => void;
}

const priorityColors = {
  low: "bg-[--color-primary] text-black",
  medium: "bg-[--color-secondary] text-black",
  high: "bg-orange-300 text-black",
  urgent: "bg-[--color-accent] text-black",
};

export function TaskCard({ task, feature, features = [], onRefresh }: TaskCardProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this task?")) {
      try {
        await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
        onRefresh();
      } catch (error) {
        console.error("Failed to delete task:", error);
      }
    }
  }

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "cursor-pointer transition-opacity",
          isDragging && "opacity-50"
        )}
      >
        <Card
          className={cn(
            "hover:translate-x-0.5 hover:translate-y-0.5 transition-transform cursor-pointer",
            task.status === "interrupted" && "border-amber-500 bg-amber-50"
          )}
          onClick={() => setIsDialogOpen(true)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm line-clamp-2">
                  {task.title}
                </CardTitle>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 cursor-grab active:cursor-grabbing border-2 border-black"
                  {...attributes}
                  {...listeners}
                  onClick={(e) => e.stopPropagation()}
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 border-2 border-black bg-[--color-accent] hover:bg-red-400"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-2">
            {task.description && (
              <p className="text-xs line-clamp-2 font-medium">
                {task.description}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {feature && <FeatureBadge feature={feature} />}

              {task.status === "interrupted" && <InterruptedBadge />}

              <Badge
                variant="outline"
                className={cn("text-xs", priorityColors[task.priority as keyof typeof priorityColors])}
              >
                {task.priority}
              </Badge>

              {task.assignedAgent && (
                <Badge variant="secondary" className="text-xs gap-1">
                  <User className="h-3 w-3" />
                  {task.assignedAgent}
                </Badge>
              )}

              {task.context && (
                <Badge variant="outline" className="text-xs gap-1">
                  <FileText className="h-3 w-3" />
                  Context
                </Badge>
              )}
            </div>

            {task.executionPlan && (
              <div className="mt-2 p-2 bg-gray-100 text-xs border-2 border-black">
                <div className="font-bold mb-1 uppercase text-[10px]">Execution Plan:</div>
                <div className="line-clamp-2 font-medium">{task.executionPlan}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <TaskDialog
        task={task}
        features={features}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onRefresh={onRefresh}
      />
    </>
  );
}
