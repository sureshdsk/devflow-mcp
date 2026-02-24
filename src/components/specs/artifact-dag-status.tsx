interface ArtifactStatus {
  id: string;
  state: "blocked" | "ready" | "in_review" | "in_progress" | "done";
  description: string;
  requires: string[];
  fileExists: boolean;
  approved: boolean;
  approvedAt?: string;
}

interface ArtifactDagStatusProps {
  statuses: ArtifactStatus[];
}

const STATE_COLORS: Record<string, string> = {
  blocked: "bg-gray-300 border-gray-400 text-gray-600",
  ready: "bg-blue-200 border-blue-500 text-blue-800",
  in_review: "bg-yellow-200 border-yellow-500 text-yellow-800",
  in_progress: "bg-orange-200 border-orange-500 text-orange-800",
  done: "bg-green-200 border-green-600 text-green-800",
};

const STATE_LABELS: Record<string, string> = {
  blocked: "Blocked",
  ready: "Ready",
  in_review: "In Review",
  in_progress: "In Progress",
  done: "Done",
};

export function ArtifactDagStatus({ statuses }: ArtifactDagStatusProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {statuses.map((status, index) => (
        <div key={status.id} className="flex items-center gap-2">
          <div
            className={`px-3 py-1 border-2 font-bold text-xs uppercase ${STATE_COLORS[status.state]}`}
          >
            <div>{status.id}</div>
            <div className="font-normal capitalize">{STATE_LABELS[status.state]}</div>
          </div>
          {index < statuses.length - 1 && (
            <span className="text-gray-400 font-bold">→</span>
          )}
        </div>
      ))}
    </div>
  );
}
