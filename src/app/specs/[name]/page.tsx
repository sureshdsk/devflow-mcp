"use client";

import { useState, useEffect, useCallback, use } from "react";
import { SpecDetail } from "@/components/specs/spec-detail";
import Link from "next/link";

interface SpecData {
  name: string;
  title: string;
  projectId?: string;
  statuses: Array<{
    id: string;
    state: "blocked" | "ready" | "in_review" | "in_progress" | "done";
    description: string;
    requires: string[];
    fileExists: boolean;
    approved: boolean;
    approvedAt?: string;
    approvedBy?: string;
  }>;
  artifacts: Record<string, string | null>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    assignedAgent: string | null;
    priority: string;
  }>;
}

export default function SpecPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [spec, setSpec] = useState<SpecData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSpec = useCallback(async function () {
    try {
      const response = await fetch(`/api/specs/${name}`);
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Spec not found");
        return;
      }
      const data = await response.json();
      setSpec(data);
    } catch {
      setError("Failed to load spec");
    }
  }, [name]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSpec(); }, [loadSpec]);

  // Real-time updates via WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;
      try {
        ws = new WebSocket(`ws://localhost:${process.env.NEXT_PUBLIC_DEVFLOW_WS_PORT || "3001"}`);
        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.specName === name && (
            data.type === "artifact_approved" ||
            data.type === "artifact_updated" ||
            data.type === "spec_promoted"
          ) || (data.type === "task_updated" && data.task?.specName === name)) {
            loadSpec();
          }
        };
        ws.onclose = () => {
          if (!isUnmounted) reconnectTimeout = setTimeout(connect, 3000);
        };
        ws.onerror = () => {};
      } catch {
        if (!isUnmounted) reconnectTimeout = setTimeout(connect, 3000);
      }
    }

    connect();
    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimeout);
      ws?.close();
    };
  }, [name, loadSpec]);

  return (
    <div className="min-h-screen bg-[--color-bg]">
      <header className="border-b-4 border-black bg-white">
        <div className="container mx-auto px-6 py-4 flex items-center gap-6">
          <Link href="/" className="text-3xl font-black uppercase tracking-tight hover:underline">
            DevFlow
          </Link>
          <nav className="flex gap-4">
            <Link href="/" className="font-bold uppercase text-sm hover:underline">Board</Link>
            <Link href="/specs" className="font-bold uppercase text-sm hover:underline">Specs</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {error ? (
          <div className="p-6 bg-red-100 border-4 border-red-500">
            <p className="font-bold text-red-800">{error}</p>
            <Link href="/specs" className="text-sm underline mt-2 block">
              Back to Specs
            </Link>
          </div>
        ) : spec ? (
          <SpecDetail
            specName={spec.name}
            title={spec.title}
            statuses={spec.statuses}
            artifacts={spec.artifacts}
            tasks={spec.tasks ?? []}
            onRefresh={loadSpec}
          />
        ) : (
          <p className="font-bold">Loading...</p>
        )}
      </main>
    </div>
  );
}
