"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock, Lock } from "lucide-react";

interface ArtifactStatus {
  id: string;
  state: "blocked" | "ready" | "in_review" | "in_progress" | "done";
}

interface SpecMeta {
  name: string;
  title: string;
  createdAt: string;
  statuses?: ArtifactStatus[];
}

interface SpecKanbanColumnProps {
  selectedSpecName: string | null;
  onSelectSpec: (name: string) => void;
}

const DOT_COLORS: Record<string, string> = {
  blocked: "bg-gray-300",
  ready: "bg-blue-400",
  in_review: "bg-yellow-400",
  in_progress: "bg-orange-400",
  done: "bg-green-500",
};

function overallState(statuses: ArtifactStatus[]): "done" | "in_progress" | "in_review" | "ready" | "blocked" {
  const all = statuses.filter((s) => s.id !== "development");
  if (all.length === 0) return "ready";
  if (all.every((s) => s.state === "done")) return "done";
  if (all.some((s) => s.state === "in_review" || s.state === "in_progress")) return "in_review";
  if (all.some((s) => s.state === "ready")) return "ready";
  return "blocked";
}

const OVERALL_ICON: Record<string, React.ReactNode> = {
  done:       <CheckCircle2 className="h-3 w-3 text-green-600" />,
  in_review:  <Clock className="h-3 w-3 text-yellow-500" />,
  in_progress:<Clock className="h-3 w-3 text-orange-500" />,
  ready:      <Circle className="h-3 w-3 text-blue-500" />,
  blocked:    <Lock className="h-3 w-3 text-gray-400" />,
};

const OVERALL_LABEL: Record<string, string> = {
  done: "done",
  in_review: "in review",
  in_progress: "in progress",
  ready: "ready",
  blocked: "blocked",
};

function SpecKanbanCard({
  spec,
  selected,
  onClick,
}: {
  spec: SpecMeta;
  selected: boolean;
  onClick: () => void;
}) {
  const state = spec.statuses ? overallState(spec.statuses) : "ready";
  const artifactStatuses = spec.statuses?.filter((s) => s.id !== "development") ?? [];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 border-4 transition-all ${
        selected
          ? "border-black bg-black text-white shadow-none translate-x-[2px] translate-y-[2px]"
          : "border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
      }`}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className={`font-black text-xs uppercase leading-tight line-clamp-2 flex-1 ${selected ? "text-white" : ""}`}>
          {spec.title || spec.name}
        </span>
        <span className="flex-shrink-0 mt-0.5">{OVERALL_ICON[state]}</span>
      </div>

      <p className={`font-mono text-[10px] mb-2 truncate ${selected ? "text-gray-300" : "text-gray-400"}`}>
        {spec.name}
      </p>

      {/* Artifact dots */}
      {artifactStatuses.length > 0 && (
        <div className="flex gap-1 items-center">
          {artifactStatuses.map((s) => (
            <div
              key={s.id}
              title={`${s.id}: ${s.state}`}
              className={`w-2 h-2 rounded-full border border-black ${selected ? "border-gray-400" : ""} ${DOT_COLORS[s.state]}`}
            />
          ))}
          <span className={`text-[10px] font-bold uppercase ml-1 ${selected ? "text-gray-300" : "text-gray-400"}`}>
            {OVERALL_LABEL[state]}
          </span>
        </div>
      )}
    </button>
  );
}

export function SpecKanbanColumn({ selectedSpecName, onSelectSpec }: SpecKanbanColumnProps) {
  const [specs, setSpecs] = useState<SpecMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/specs");
        const data: SpecMeta[] = await res.json();
        // Fetch statuses for each spec in parallel
        const withStatuses = await Promise.all(
          data.map(async (spec) => {
            try {
              const r = await fetch(`/api/specs/${spec.name}`);
              const detail = await r.json();
              return { ...spec, statuses: detail.statuses };
            } catch {
              return spec;
            }
          })
        );
        setSpecs(withStatuses);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 border-r-4 border-black bg-[--color-bg]" style={{ width: 220, flexShrink: 0 }}>
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black bg-[--color-secondary] flex-shrink-0">
        <h2 className="font-black uppercase text-sm tracking-wide">Specs</h2>
        <span className="text-xs font-bold opacity-60">({specs.length})</span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {loading && (
          <p className="text-xs text-gray-400 font-mono px-1">Loading...</p>
        )}
        {!loading && specs.length === 0 && (
          <p className="text-xs text-gray-400 font-mono px-1">No specs yet.</p>
        )}
        {specs.map((spec) => (
          <SpecKanbanCard
            key={spec.name}
            spec={spec}
            selected={selectedSpecName === spec.name}
            onClick={() => onSelectSpec(spec.name)}
          />
        ))}
      </div>
    </div>
  );
}
