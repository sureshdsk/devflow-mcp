"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Task, Feature } from "@/db/schema";
import { TaskCard } from "./task-card";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  tasks: Task[];
  features?: Feature[];
  onRefresh: () => void;
}

export function KanbanColumn({ id, title, color, tasks, features = [], onRefresh }: KanbanColumnProps) {
  function getFeatureForTask(task: Task): Feature | undefined {
    if (!task.featureId) return undefined;
    return features.find(f => f.id === task.featureId);
  }
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className={cn("px-4 py-3 border-3 border-black border-b-0", color)}>
        <h2 className="font-black uppercase tracking-wide text-black flex items-center justify-between">
          <span>{title}</span>
          <span className="text-sm font-bold bg-black text-white px-2 py-1">
            {tasks.length}
          </span>
        </h2>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-3 bg-white border-3 border-black transition-colors",
          isOver && "bg-gray-100"
        )}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              feature={getFeatureForTask(task)}
              features={features}
              onRefresh={onRefresh}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="text-center text-gray-500 font-bold text-sm py-8 uppercase">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
}
