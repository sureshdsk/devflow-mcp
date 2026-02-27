'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Task, Project } from '@/db/schema';
import { KanbanColumn } from './kanban-column';
import { TaskCard } from './task-card';
import { ChevronDown, Trash2 } from 'lucide-react';
import { SpecKanbanColumn } from './specs/spec-kanban-column';
import { SpecModal } from './specs/spec-modal';
import { useProjects, useTasks, useInvalidate } from '@/hooks/use-queries';
import { useWebSocket } from '@/hooks/use-websocket';

type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'interrupted' | 'done';

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-200' },
  { id: 'todo', title: 'To Do', color: 'bg-[--color-primary]' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-[--color-secondary]' },
  { id: 'done', title: 'Done', color: 'bg-[--color-success]' },
];

const COLUMN_IDS: Set<string> = new Set(COLUMNS.map((c) => c.id));

const STORAGE_KEY = 'devflow-selected-project';

export function KanbanBoard() {
  const { data: projects = [], isLoading: projectsLoading } = useProjects();
  const { data: tasks = [], isLoading: tasksLoading } = useTasks();
  const { invalidateTasks, invalidateProjects } = useInvalidate();
  useWebSocket();

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedSpecName, setSelectedSpecName] = useState<string | null>(null);
  const [specPanelOpen, setSpecPanelOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
  );

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setSelectedProjectId(saved === 'all' ? null : saved);
    }
    setIsInitialized(true);
  }, []);

  // Auto-select project if needed
  useEffect(() => {
    if (!isInitialized || projectsLoading) return;
    if (selectedProjectId) {
      const exists = projects.some((p: Project) => p.id === selectedProjectId);
      if (!exists && projects.length > 0) {
        selectProject(projects[0].id);
      }
    } else if (!localStorage.getItem(STORAGE_KEY) && projects.length > 0) {
      selectProject(projects[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized, projectsLoading, projects]);

  const selectProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
    setSelectedSpecName(null);
    localStorage.setItem(STORAGE_KEY, projectId || 'all');
    setIsDropdownOpen(false);
  }, []);

  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      invalidateTasks();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task || null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    let newStatus: TaskStatus;
    if (COLUMN_IDS.has(overId)) {
      newStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      newStatus = overTask.status as TaskStatus;
    }

    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      updateTaskStatus(taskId, newStatus);
    }
  }

  function getTasksByStatus(status: TaskStatus) {
    return tasks
      .filter((task) => {
        if (task.status === 'interrupted') {
          return status === 'in_progress';
        }
        return task.status === status;
      })
      .filter((task) => !selectedProjectId || task.projectId === selectedProjectId)
      .filter((task) => !selectedSpecName || task.specName === selectedSpecName);
  }

  async function deleteProject(projectId: string, projectName: string) {
    const taskCount = tasks.filter((t) => t.projectId === projectId).length;
    const confirmMessage =
      taskCount > 0
        ? `Delete "${projectName}" and its ${taskCount} task${taskCount === 1 ? '' : 's'}? This cannot be undone.`
        : `Delete "${projectName}"? This cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        if (selectedProjectId === projectId) {
          selectProject(null);
        }
        invalidateProjects();
        invalidateTasks();
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }

  const isLoading = tasksLoading && !tasks.length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-lg">Loading tasks...</div>
      </div>
    );
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const projectTasks = selectedProjectId
    ? tasks.filter((t) => t.projectId === selectedProjectId)
    : tasks;
  const filteredTasks = selectedSpecName
    ? projectTasks.filter((t) => t.specName === selectedSpecName)
    : projectTasks;
  const totalTasks = filteredTasks.length;

  return (
    <div className="h-screen flex flex-col bg-[--color-bg]">
      <header className="border-b-4 border-black bg-white neubrutalism-shadow">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-black uppercase tracking-tight">DevFlow</h1>
              </div>

              {/* Project Chooser Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-[--color-primary] border-4 border-black font-bold text-sm uppercase hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <span className="max-w-[200px] truncate">
                    {selectedProject ? selectedProject.name : 'All Projects'}
                  </span>
                  <span className="text-xs opacity-70">({totalTasks})</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {isDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)} />

                    <div className="absolute top-full left-0 mt-2 w-64 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 max-h-80 overflow-y-auto">
                      <button
                        onClick={() => selectProject(null)}
                        className={`w-full px-4 py-3 text-left font-bold text-sm uppercase border-b-2 border-black hover:bg-gray-100 flex items-center justify-between ${
                          !selectedProjectId ? 'bg-black text-white hover:bg-gray-800' : ''
                        }`}
                      >
                        <span>All Projects</span>
                        <span className="text-xs opacity-70">({tasks.length})</span>
                      </button>

                      {projects.map((project) => {
                        const projectTaskCount = tasks.filter(
                          (t) => t.projectId === project.id,
                        ).length;
                        return (
                          <div
                            key={project.id}
                            className={`flex items-center border-b border-gray-200 last:border-b-0 ${
                              selectedProjectId === project.id
                                ? 'bg-[--color-primary]'
                                : 'hover:bg-gray-100'
                            }`}
                          >
                            <button
                              onClick={() => selectProject(project.id)}
                              className="flex-1 px-4 py-3 text-left font-bold text-sm flex items-center justify-between"
                            >
                              <span className="truncate">{project.name}</span>
                              <span className="text-xs opacity-70 ml-2">({projectTaskCount})</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProject(project.id, project.name);
                              }}
                              className="px-3 py-3 text-red-600 hover:bg-red-100 hover:text-red-800 transition-colors"
                              title="Delete project"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        );
                      })}

                      {projects.length === 0 && (
                        <div className="px-4 py-3 text-sm text-gray-500">No projects yet</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div />
          </div>
        </div>
      </header>

      {selectedProject && (
        <div className="bg-[--color-primary] border-b-4 border-black px-6 py-2">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-black uppercase">{selectedProject.name}</h2>
              {selectedProject.description && (
                <p className="text-sm font-medium opacity-80">— {selectedProject.description}</p>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm font-bold">
              <span>
                {projectTasks.filter((t) => t.status === 'in_progress').length} in progress
              </span>
              <span>{projectTasks.filter((t) => t.status === 'done').length} done</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Specs column */}
        <SpecKanbanColumn
          selectedSpecName={selectedSpecName}
          onSelectSpec={(name) => {
            if (selectedSpecName === name && specPanelOpen) {
              setSpecPanelOpen(false);
            } else {
              setSelectedSpecName(name);
              setSpecPanelOpen(true);
            }
          }}
        />

        {/* Kanban columns */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full px-6 py-6">
              <div className="grid grid-cols-4 gap-6 h-full min-h-0">
                {COLUMNS.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    id={column.id}
                    title={column.title}
                    color={column.color}
                    tasks={getTasksByStatus(column.id)}
                    features={[]}
                    onRefresh={() => invalidateTasks()}
                  />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="rotate-3 opacity-80">
                  <TaskCard
                    task={activeTask}
                    feature={undefined}
                    features={[]}
                    onRefresh={() => invalidateTasks()}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>

        {/* Spec modal */}
        {specPanelOpen && selectedSpecName && (
          <SpecModal specName={selectedSpecName} onClose={() => setSpecPanelOpen(false)} />
        )}
      </div>
    </div>
  );
}
