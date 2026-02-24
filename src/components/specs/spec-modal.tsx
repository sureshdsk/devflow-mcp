"use client";

import { useState, useEffect } from "react";
import { X, FileText, ChevronRight, CheckCircle2, Circle, Clock, Lock } from "lucide-react";
import { ArtifactEditor } from "./artifact-editor";
import { ArtifactDagStatus } from "./artifact-dag-status";
import { Button } from "@/components/ui/button";
import { MarkdownPreview } from "@/components/markdown-preview";

interface ArtifactStatus {
  id: string;
  state: "blocked" | "ready" | "in_review" | "in_progress" | "done";
  description: string;
  requires: string[];
  fileExists: boolean;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
}

interface PromotedTask {
  id: string;
  title: string;
  status: string;
  assignedAgent: string | null;
  priority: string;
}

interface SpecDetail {
  name: string;
  title: string;
  statuses: ArtifactStatus[];
  artifacts: Record<string, string | null>;
  tasks: PromotedTask[];
}

interface SpecModalProps {
  specName: string;
  onClose: () => void;
}

const STATE_ICON: Record<string, React.ReactNode> = {
  blocked:     <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />,
  ready:       <Circle className="h-3 w-3 text-blue-500 flex-shrink-0" />,
  in_review:   <Clock className="h-3 w-3 text-yellow-500 flex-shrink-0" />,
  in_progress: <Clock className="h-3 w-3 text-orange-500 flex-shrink-0" />,
  done:        <CheckCircle2 className="h-3 w-3 text-green-600 flex-shrink-0" />,
};

const TASK_STATUS_COLORS: Record<string, string> = {
  backlog:     "bg-gray-100 border-gray-400 text-gray-600",
  todo:        "bg-blue-100 border-blue-400 text-blue-700",
  in_progress: "bg-orange-100 border-orange-400 text-orange-700",
  interrupted: "bg-red-100 border-red-400 text-red-700",
  done:        "bg-green-100 border-green-500 text-green-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-600",
  high:   "text-orange-500",
  medium: "text-gray-500",
  low:    "text-gray-400",
};

function DevelopmentPanel({ tasks, status }: { tasks: PromotedTask[]; status: ArtifactStatus | undefined }) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;

  if (status?.state === "blocked") {
    return (
      <div className="p-6 bg-gray-100 border-4 border-gray-300 text-center">
        <p className="font-bold text-gray-600 uppercase">Blocked — approve and promote tasks first</p>
        <p className="text-sm text-gray-500 mt-1">Approve all artifacts, then click "Promote to Tasks"</p>
      </div>
    );
  }
  if (tasks.length === 0) {
    return (
      <div className="p-6 bg-blue-50 border-4 border-blue-300 text-center">
        <p className="font-bold text-blue-700 uppercase">Ready to promote</p>
        <p className="text-sm text-blue-600 mt-1">All artifacts approved. Promote tasks to start development.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-gray-200 border-2 border-black overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }} />
        </div>
        <span className="font-mono text-sm font-bold whitespace-nowrap">
          {done}/{total} done
          {inProgress > 0 && <span className="text-orange-600 ml-2">· {inProgress} in progress</span>}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-3 border-4 border-black bg-white">
            <span className={`text-lg ${task.status === "done" ? "opacity-100" : "opacity-30"}`}>
              {task.status === "done" ? "✓" : task.status === "in_progress" ? "⟳" : "○"}
            </span>
            <span className={`flex-1 font-bold text-sm ${task.status === "done" ? "line-through text-gray-400" : ""}`}>
              {task.title}
            </span>
            <span className={`text-xs font-mono uppercase font-bold ${PRIORITY_COLORS[task.priority] || ""}`}>
              {task.priority}
            </span>
            <span className={`px-2 py-0.5 border-2 text-xs font-bold uppercase ${TASK_STATUS_COLORS[task.status] || ""}`}>
              {task.status.replace("_", " ")}
            </span>
            {task.assignedAgent && (
              <span className="text-xs font-mono text-gray-500 truncate max-w-[120px]" title={task.assignedAgent}>
                @{task.assignedAgent}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SpecModal({ specName, onClose }: SpecModalProps) {
  const [spec, setSpec] = useState<SpecDetail | null>(null);
  const [activeNode, setActiveNode] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);

  async function load() {
    const r = await fetch(`/api/specs/${specName}`);
    const data = await r.json();
    setSpec(data);
    // Auto-select first artifact
    if (!activeNode && data.statuses?.length) {
      setActiveNode(data.statuses[0].id);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specName]);

  async function handlePromote() {
    setIsPromoting(true);
    try {
      const r = await fetch(`/api/specs/${specName}/promote`, { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        alert(`Promoted ${data.promoted} tasks to Kanban board!`);
        load();
      } else {
        alert(`Error: ${data.error}`);
      }
    } finally {
      setIsPromoting(false);
    }
  }

  const artifactStatuses = spec?.statuses.filter((s) => s.id !== "development") ?? [];
  const developmentStatus = spec?.statuses.find((s) => s.id === "development");
  const allArtifactsApproved = artifactStatuses.every((s) => s.state === "done");
  const activeStatus = spec?.statuses.find((s) => s.id === activeNode);
  const isDevelopment = activeNode === "development";

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col"
        style={{ width: "min(1300px, 96vw)", height: "min(920px, 94vh)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-4 border-black bg-white flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black uppercase leading-tight">
              {spec?.title || specName}
            </h2>
            <p className="font-mono text-xs text-gray-500 mt-0.5">{specName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 border-4 border-black hover:bg-black hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* DAG progress bar */}
        {spec && (
          <div className="px-6 py-3 border-b-4 border-black bg-white flex-shrink-0">
            <ArtifactDagStatus statuses={spec.statuses} />
          </div>
        )}

        {/* Promote / complete banners */}
        {allArtifactsApproved && spec?.tasks.length === 0 && (
          <div className="px-6 py-3 border-b-4 border-green-600 bg-green-100 flex-shrink-0 flex items-center justify-between">
            <p className="font-black text-green-800 uppercase text-sm">All artifacts approved!</p>
            <Button onClick={handlePromote} disabled={isPromoting} className="bg-green-600 hover:bg-green-700 text-white">
              {isPromoting ? "Promoting..." : "Promote to Tasks"}
            </Button>
          </div>
        )}
        {developmentStatus?.state === "done" && (
          <div className="px-6 py-3 border-b-4 border-green-600 bg-green-100 flex-shrink-0">
            <p className="font-black text-green-800 uppercase text-sm">
              ✓ Spec complete — all {spec?.tasks.length} tasks done
            </p>
          </div>
        )}

        {/* Body: tree + editor */}
        <div className="flex flex-1 min-h-0">

          {/* File tree */}
          <div className="w-60 border-r-4 border-black bg-white flex flex-col flex-shrink-0 overflow-y-auto">
            <div className="px-3 py-2 border-b-2 border-gray-200">
              <span className="font-mono text-[10px] text-gray-400 uppercase tracking-widest">
                {specName}/
              </span>
            </div>

            <div className="flex-1 py-1">
              {spec ? (
                <>
                  {artifactStatuses.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveNode(s.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors group ${
                        activeNode === s.id
                          ? "bg-black text-white"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      <ChevronRight className={`h-3 w-3 flex-shrink-0 ${activeNode === s.id ? "text-white" : "text-gray-300"}`} />
                      <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${activeNode === s.id ? "text-white" : "text-gray-400"}`} />
                      <span className="font-mono text-xs font-bold flex-1 truncate">{s.id}.md</span>
                      <span className={activeNode === s.id ? "text-white opacity-70" : ""}>
                        {STATE_ICON[s.state]}
                      </span>
                    </button>
                  ))}

                  {/* development entry — only shown after tasks approved */}
                  {(allArtifactsApproved || (spec.tasks.length > 0)) && (
                    <>
                      <div className="mx-3 my-1 border-t border-dashed border-gray-200" />
                      <button
                        onClick={() => setActiveNode("development")}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                          activeNode === "development"
                            ? "bg-black text-white"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <ChevronRight className={`h-3 w-3 flex-shrink-0 ${activeNode === "development" ? "text-white" : "text-gray-300"}`} />
                        <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${activeNode === "development" ? "text-white" : "text-gray-400"}`} />
                        <span className="font-mono text-xs font-bold flex-1">development</span>
                        <span className={activeNode === "development" ? "text-white opacity-70" : ""}>
                          {developmentStatus ? STATE_ICON[developmentStatus.state] : null}
                        </span>
                      </button>
                    </>
                  )}
                </>
              ) : (
                <div className="px-4 py-3 text-xs text-gray-400 font-mono">Loading...</div>
              )}
            </div>
          </div>

          {/* Editor area */}
          <div className="flex-1 flex flex-col min-h-0 p-6">
            {!spec ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-gray-400 font-mono text-sm">Loading...</span>
              </div>
            ) : !activeNode ? null
            : isDevelopment ? (
              <DevelopmentPanel tasks={spec.tasks} status={developmentStatus} />
            ) : activeStatus ? (
              <ArtifactEditor
                key={activeNode}
                specName={specName}
                artifactType={activeNode}
                content={spec.artifacts[activeNode] ?? null}
                status={activeStatus}
                onSave={load}
                defaultMode="preview"
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
