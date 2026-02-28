import { useParams, Link } from 'react-router-dom';
import { SpecDetail } from '@/components/specs/spec-detail';
import { useSpec, useInvalidate } from '@/hooks/use-queries';
import { useWebSocket } from '@/hooks/use-websocket';

interface SpecData {
  name: string;
  title: string;
  statuses: Array<{
    id: string;
    state: 'blocked' | 'ready' | 'in_review' | 'in_progress' | 'done';
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

export default function SpecPage() {
  const { name } = useParams<{ name: string }>();
  const { data, isLoading, error } = useSpec(name!);
  const { invalidateSpec, invalidateSpecs } = useInvalidate();
  useWebSocket();

  const spec = data as SpecData | undefined;

  function handleRefresh() {
    invalidateSpec(name!);
    invalidateSpecs();
  }

  return (
    <div className="min-h-screen bg-[--color-bg]">
      <header className="border-b-4 border-black bg-white">
        <div className="container mx-auto px-6 py-4 flex items-center gap-6">
          <Link to="/" className="text-3xl font-black uppercase tracking-tight hover:underline">
            DevFlow
          </Link>
          <nav className="flex gap-4">
            <Link to="/" className="font-bold uppercase text-sm hover:underline">
              Board
            </Link>
            <Link to="/specs" className="font-bold uppercase text-sm hover:underline">
              Specs
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        {error ? (
          <div className="p-6 bg-red-100 border-4 border-red-500">
            <p className="font-bold text-red-800">Failed to load spec</p>
            <Link to="/specs" className="text-sm underline mt-2 block">
              Back to Specs
            </Link>
          </div>
        ) : isLoading ? (
          <p className="font-bold">Loading...</p>
        ) : spec ? (
          <SpecDetail
            specName={spec.name}
            title={spec.title}
            statuses={spec.statuses}
            artifacts={spec.artifacts}
            tasks={spec.tasks ?? []}
            onRefresh={handleRefresh}
          />
        ) : null}
      </main>
    </div>
  );
}
