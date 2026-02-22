"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Task, Project, Feature, File as DbFile } from "@/db/schema";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { Button } from "./ui/button";
import { Plus, FolderPlus, ChevronDown, Trash2, Layers } from "lucide-react";
import { FeatureSidebar } from "./feature-sidebar";
import { MarkdownEditor } from "./markdown-editor";

type TaskStatus = "backlog" | "todo" | "in_progress" | "interrupted" | "done";

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
  { id: "backlog", title: "Backlog", color: "bg-gray-200" },
  { id: "todo", title: "To Do", color: "bg-[--color-primary]" },
  { id: "in_progress", title: "In Progress", color: "bg-[--color-secondary]" },
  { id: "done", title: "Done", color: "bg-[--color-success]" },
];

const COLUMN_IDS: Set<string> = new Set(COLUMNS.map((c) => c.id));

const STORAGE_KEY = "devflow-selected-project";

export function KanbanBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [files, setFiles] = useState<DbFile[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedFeatureId, setSelectedFeatureId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Ref to track current project ID for WebSocket handler
  const selectedProjectIdRef = useRef<string | null>(null);
  selectedProjectIdRef.current = selectedProjectId;

  // Markdown editor state
  const [editorFile, setEditorFile] = useState<DbFile | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Load saved project selection from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      // "all" means show all projects
      setSelectedProjectId(saved === "all" ? null : saved);
    }
    setIsInitialized(true);
  }, []);

  // Save project selection to localStorage
  const selectProject = useCallback((projectId: string | null) => {
    setSelectedProjectId(projectId);
    setSelectedFeatureId(null); // Reset feature selection when project changes
    localStorage.setItem(STORAGE_KEY, projectId || "all");
    setIsDropdownOpen(false);
  }, []);

  // Fetch projects and tasks
  useEffect(() => {
    fetchProjects();
    fetchTasks();

    // Poll for updates every 5 seconds as fallback for WebSocket
    const pollInterval = setInterval(() => {
      fetchTasks();
      fetchProjects();
      if (selectedProjectId) {
        fetchFeatures(selectedProjectId);
        fetchFiles(selectedProjectId);
      }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Fetch features and files when project changes
  useEffect(() => {
    async function loadProjectData() {
      if (selectedProjectId) {
        // Fetch features first, then use them to fetch files
        const featuresResponse = await fetch(`/api/features?projectId=${selectedProjectId}`);
        const featuresData = await featuresResponse.json();
        setFeatures(featuresData);
        // Pass features to fetchFiles to avoid stale state
        await fetchFiles(selectedProjectId, featuresData);
      } else {
        setFeatures([]);
        setFiles([]);
      }
    }
    loadProjectData();
  }, [selectedProjectId]);

  // WebSocket connection for real-time updates with reconnection
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;

      try {
        ws = new WebSocket("ws://localhost:3001");

        ws.onopen = () => {
          console.log("WebSocket connected");
        };

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          console.log("WebSocket update:", data);

          // Use ref to get current project ID (avoids stale closure)
          const currentProjectId = selectedProjectIdRef.current;

          // Refresh data on any update
          if (data.type?.includes("project")) {
            fetchProjects();
          }
          if (data.type?.includes("feature") && currentProjectId) {
            fetchFeatures(currentProjectId);
          }
          if (data.type?.includes("file") && currentProjectId) {
            fetchFiles(currentProjectId);
          }
          fetchTasks();
        };

        ws.onerror = () => {
          // Silently handle errors, will reconnect on close
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected, reconnecting in 3s...");
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch {
        // WebSocket not available, retry later
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once - uses ref for current project ID

  async function fetchProjects() {
    try {
      const response = await fetch("/api/projects");
      const data = await response.json();
      setProjects(data);

      // If we have a saved selection, validate it still exists
      if (isInitialized && selectedProjectId) {
        const exists = data.some((p: Project) => p.id === selectedProjectId);
        if (!exists && data.length > 0) {
          // Saved project no longer exists, select first one
          selectProject(data[0].id);
        }
      } else if (isInitialized && !selectedProjectId && !localStorage.getItem(STORAGE_KEY)) {
        // No saved selection and first load, select first project
        if (data.length > 0) {
          selectProject(data[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch projects:", error);
    }
  }

  async function fetchTasks() {
    try {
      const response = await fetch("/api/tasks");
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchFeatures(projectId: string) {
    try {
      const response = await fetch(`/api/features?projectId=${projectId}`);
      const data = await response.json();
      setFeatures(data);
    } catch (error) {
      console.error("Failed to fetch features:", error);
    }
  }

  async function fetchFiles(projectId: string, featureList?: Feature[]) {
    try {
      // Fetch project-level files
      const response = await fetch(`/api/files?projectId=${projectId}`);
      const projectFiles = await response.json();

      // Use provided feature list or fetch features first
      let currentFeatures: Feature[] = featureList || [];
      if (!featureList) {
        const featuresResponse = await fetch(`/api/features?projectId=${projectId}`);
        currentFeatures = await featuresResponse.json();
      }

      // Fetch files for all features
      const featureFilesPromises = currentFeatures.map(f =>
        fetch(`/api/files?featureId=${f.id}`).then(r => r.json())
      );
      const featureFilesArrays = await Promise.all(featureFilesPromises);
      const allFeatureFiles = featureFilesArrays.flat();

      // Combine and dedupe
      const allFiles = [...projectFiles, ...allFeatureFiles];
      const uniqueFiles = allFiles.filter((file: DbFile, index: number, self: DbFile[]) =>
        index === self.findIndex(f => f.id === file.id)
      );

      setFiles(uniqueFiles);
    } catch (error) {
      console.error("Failed to fetch files:", error);
    }
  }

  async function updateTaskStatus(taskId: string, newStatus: TaskStatus) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchTasks();
    } catch (error) {
      console.error("Failed to update task:", error);
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

    // over.id can be a column ID or a task ID (when dropped over another card)
    let newStatus: TaskStatus;
    if (COLUMN_IDS.has(overId)) {
      newStatus = overId as TaskStatus;
    } else {
      // Dropped over a task card — use that task's status as the target column
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
        // Handle interrupted tasks - show them in in_progress column
        if (task.status === "interrupted") {
          return status === "in_progress";
        }
        return task.status === status;
      })
      .filter((task) => !selectedProjectId || task.projectId === selectedProjectId)
      .filter((task) => !selectedFeatureId || task.featureId === selectedFeatureId);
  }

  function getFeatureForTask(task: Task): Feature | undefined {
    if (!task.featureId) return undefined;
    return features.find(f => f.id === task.featureId);
  }

  async function createTask() {
    if (!selectedProjectId) {
      alert("Please select a project first");
      return;
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Task",
          description: "Click to edit",
          priority: "medium",
          projectId: selectedProjectId,
          featureId: selectedFeatureId || undefined,
        }),
      });

      if (response.ok) {
        await fetchTasks();
      }
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  }

  async function createProject() {
    const name = prompt("Enter project name:");
    if (!name) return;

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: "",
        }),
      });

      if (response.ok) {
        const newProject = await response.json();
        await fetchProjects();
        selectProject(newProject.id);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  }

  async function deleteProject(projectId: string, projectName: string) {
    const taskCount = tasks.filter((t) => t.projectId === projectId).length;
    const confirmMessage = taskCount > 0
      ? `Delete "${projectName}" and its ${taskCount} task${taskCount === 1 ? "" : "s"}? This cannot be undone.`
      : `Delete "${projectName}"? This cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        // If we deleted the selected project, switch to "All Projects"
        if (selectedProjectId === projectId) {
          selectProject(null);
        }
        await fetchProjects();
        await fetchTasks();
      }
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  }

  function handleFileClick(file: DbFile) {
    setEditorFile(file);
    setIsEditorOpen(true);
  }

  function handleEditorSave() {
    if (selectedProjectId) {
      fetchFiles(selectedProjectId);
    }
  }

  function handleRefreshAll() {
    fetchTasks();
    if (selectedProjectId) {
      fetchFeatures(selectedProjectId);
      fetchFiles(selectedProjectId);
    }
  }

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
  const filteredTasks = selectedFeatureId
    ? projectTasks.filter((t) => t.featureId === selectedFeatureId)
    : projectTasks;
  const totalTasks = filteredTasks.length;

  return (
    <div className="h-screen flex flex-col bg-[--color-bg]">
      <header className="border-b-4 border-black bg-white neubrutalism-shadow">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">DevFlow</h1>
              </div>

              {/* Project Chooser Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 bg-[--color-primary] border-4 border-black font-bold text-sm uppercase hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  <span className="max-w-[200px] truncate">
                    {selectedProject ? selectedProject.name : "All Projects"}
                  </span>
                  <span className="text-xs opacity-70">({totalTasks})</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsDropdownOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 max-h-80 overflow-y-auto">
                      <button
                        onClick={() => selectProject(null)}
                        className={`w-full px-4 py-3 text-left font-bold text-sm uppercase border-b-2 border-black hover:bg-gray-100 flex items-center justify-between ${
                          !selectedProjectId ? "bg-black text-white hover:bg-gray-800" : ""
                        }`}
                      >
                        <span>All Projects</span>
                        <span className="text-xs opacity-70">({tasks.length})</span>
                      </button>

                      {projects.map((project) => {
                        const projectTaskCount = tasks.filter((t) => t.projectId === project.id).length;
                        return (
                          <div
                            key={project.id}
                            className={`flex items-center border-b border-gray-200 last:border-b-0 ${
                              selectedProjectId === project.id ? "bg-[--color-primary]" : "hover:bg-gray-100"
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
                        <div className="px-4 py-3 text-sm text-gray-500">
                          No projects yet
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Feature indicator */}
              {selectedFeatureId && (
                <div className="flex items-center gap-2 px-3 py-1 bg-[--color-secondary] border-2 border-black text-sm font-bold">
                  <Layers className="h-4 w-4" />
                  <span>{features.find(f => f.id === selectedFeatureId)?.name}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={createProject} variant="outline" size="sm" className="gap-2">
                <FolderPlus className="h-4 w-4" />
                New Project
              </Button>
              <Button onClick={createTask} size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New Task
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Current Project Info Bar */}
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
              <span>{projectTasks.filter((t) => t.status === "in_progress").length} in progress</span>
              <span>{projectTasks.filter((t) => t.status === "interrupted").length} interrupted</span>
              <span>{projectTasks.filter((t) => t.status === "done").length} done</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden flex">
        {/* Feature Sidebar */}
        <FeatureSidebar
          projectId={selectedProjectId}
          features={features}
          files={files}
          tasks={projectTasks}
          selectedFeatureId={selectedFeatureId}
          onSelectFeature={setSelectedFeatureId}
          onFileClick={handleFileClick}
          onRefresh={handleRefreshAll}
        />

        {/* Main Kanban Board */}
        <main className="flex-1 min-h-0 overflow-hidden">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="h-full px-6 py-6">
              <div className="grid grid-cols-4 gap-6 h-full min-h-0">
                {COLUMNS.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    id={column.id}
                    title={column.title}
                    color={column.color}
                    tasks={getTasksByStatus(column.id)}
                    features={features}
                    onRefresh={fetchTasks}
                  />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="rotate-3 opacity-80">
                  <TaskCard
                    task={activeTask}
                    feature={getFeatureForTask(activeTask)}
                    features={features}
                    onRefresh={fetchTasks}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      </div>

      {/* Markdown Editor Sheet */}
      <MarkdownEditor
        file={editorFile}
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleEditorSave}
      />
    </div>
  );
}
