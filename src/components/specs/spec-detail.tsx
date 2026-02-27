'use client';

import { useState } from 'react';
import { ArtifactDagStatus } from './artifact-dag-status';
import { ArtifactEditor } from './artifact-editor';
import { Button } from '@/components/ui/button';

interface ArtifactStatus {
  id: string;
  state: 'blocked' | 'ready' | 'in_review' | 'in_progress' | 'done';
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

interface SpecDetailProps {
  specName: string;
  title: string;
  statuses: ArtifactStatus[];
  artifacts: Record<string, string | null>;
  tasks: PromotedTask[];
  onRefresh: () => void;
}

const TASK_STATUS_COLORS: Record<string, string> = {
  backlog: 'bg-gray-100 border-gray-400 text-gray-600',
  todo: 'bg-blue-100 border-blue-400 text-blue-700',
  in_progress: 'bg-orange-100 border-orange-400 text-orange-700',
  interrupted: 'bg-red-100 border-red-400 text-red-700',
  done: 'bg-green-100 border-green-500 text-green-700',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'text-red-600',
  high: 'text-orange-500',
  medium: 'text-gray-500',
  low: 'text-gray-400',
};

export function SpecDetail({
  specName,
  title,
  statuses,
  artifacts,
  tasks,
  onRefresh,
}: SpecDetailProps) {
  const [activeTab, setActiveTab] = useState(statuses[0]?.id || 'proposal');
  const [isPromoting, setIsPromoting] = useState(false);

  const artifactStatuses = statuses.filter((s) => s.id !== 'development');
  const allArtifactsApproved = artifactStatuses.every((s) => s.state === 'done');
  const developmentStatus = statuses.find((s) => s.id === 'development');

  async function handlePromote() {
    setIsPromoting(true);
    try {
      const response = await fetch(`/api/specs/${specName}/promote`, {
        method: 'POST',
      });
      const data = await response.json();
      if (response.ok) {
        alert(`Promoted ${data.promoted} tasks to Kanban board!`);
        onRefresh();
      } else {
        alert(`Error: ${data.error}`);
      }
    } finally {
      setIsPromoting(false);
    }
  }

  const activeStatus = statuses.find((s) => s.id === activeTab);
  const isDevelopmentTab = activeTab === 'development';

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const inProgress = tasks.filter((t) => t.status === 'in_progress').length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-black uppercase">{title}</h1>
        <p className="text-sm font-mono text-gray-500 mt-1">{specName}</p>
      </div>

      <ArtifactDagStatus statuses={statuses} />

      {allArtifactsApproved && tasks.length === 0 && (
        <div className="p-4 bg-green-100 border-4 border-green-600">
          <p className="font-black text-green-800 uppercase">All artifacts approved!</p>
          <div className="mt-3">
            <Button
              onClick={handlePromote}
              disabled={isPromoting}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {isPromoting ? 'Promoting...' : 'Promote to Tasks'}
            </Button>
          </div>
        </div>
      )}

      {developmentStatus?.state === 'done' && (
        <div className="p-4 bg-green-100 border-4 border-green-600">
          <p className="font-black text-green-800 uppercase">
            ✓ Spec complete — all {total} tasks done
          </p>
        </div>
      )}

      <div>
        <div className="flex border-b-4 border-black">
          {statuses.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveTab(s.id)}
              className={`px-4 py-2 font-bold uppercase text-sm border-r-4 border-black last:border-r-0 ${
                activeTab === s.id ? 'bg-black text-white' : 'bg-white hover:bg-gray-100'
              }`}
            >
              {s.id}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {isDevelopmentTab ? (
            <DevelopmentPanel
              tasks={tasks}
              status={developmentStatus}
              total={total}
              done={done}
              inProgress={inProgress}
            />
          ) : activeStatus ? (
            <ArtifactEditor
              key={activeTab}
              specName={specName}
              artifactType={activeTab}
              content={artifacts[activeTab] || null}
              status={activeStatus}
              onSave={onRefresh}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DevelopmentPanel({
  tasks,
  status,
  total,
  done,
  inProgress,
}: {
  tasks: PromotedTask[];
  status: ArtifactStatus | undefined;
  total: number;
  done: number;
  inProgress: number;
}) {
  if (status?.state === 'blocked') {
    return (
      <div className="p-6 bg-gray-100 border-4 border-gray-300 text-center">
        <p className="font-bold text-gray-600 uppercase">
          Blocked — approve and promote tasks first
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Approve all artifacts, then click &ldquo;Promote to Tasks&rdquo;
        </p>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="p-6 bg-blue-50 border-4 border-blue-300 text-center">
        <p className="font-bold text-blue-700 uppercase">Ready to promote</p>
        <p className="text-sm text-blue-600 mt-1">
          All artifacts approved. Promote tasks to start development.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-3 bg-gray-200 border-2 border-black overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
          />
        </div>
        <span className="font-mono text-sm font-bold whitespace-nowrap">
          {done}/{total} done
          {inProgress > 0 && (
            <span className="text-orange-600 ml-2">· {inProgress} in progress</span>
          )}
        </span>
      </div>

      {/* Task list */}
      <div className="flex flex-col gap-2">
        {tasks.map((task) => (
          <div key={task.id} className="flex items-center gap-3 p-3 border-4 border-black bg-white">
            <span className={`text-lg ${task.status === 'done' ? 'opacity-100' : 'opacity-30'}`}>
              {task.status === 'done' ? '✓' : task.status === 'in_progress' ? '⟳' : '○'}
            </span>
            <span
              className={`flex-1 font-bold text-sm ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}
            >
              {task.title}
            </span>
            <span
              className={`text-xs font-mono uppercase font-bold ${PRIORITY_COLORS[task.priority] || ''}`}
            >
              {task.priority}
            </span>
            <span
              className={`px-2 py-0.5 border-2 text-xs font-bold uppercase ${TASK_STATUS_COLORS[task.status] || ''}`}
            >
              {task.status.replace('_', ' ')}
            </span>
            {task.assignedAgent && (
              <span
                className="text-xs font-mono text-gray-500 truncate max-w-[120px]"
                title={task.assignedAgent}
              >
                @{task.assignedAgent}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
