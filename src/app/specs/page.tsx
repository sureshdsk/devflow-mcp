"use client";

import { useState, useEffect, useCallback } from "react";
import { SpecCard } from "@/components/specs/spec-card";
import Link from "next/link";

interface SpecWithStatuses {
  name: string;
  title: string;
  createdAt: string;
  statuses?: Array<{ id: string; state: "blocked" | "ready" | "in_review" | "done" }>;
}

export default function SpecsPage() {
  const [specs, setSpecs] = useState<SpecWithStatuses[]>([]);

  const loadSpecs = useCallback(async function () {
    try {
      const response = await fetch("/api/specs");
      const data = await response.json();
      const withStatuses = await Promise.all(
        data.map(async (spec: SpecWithStatuses) => {
          try {
            const detailResponse = await fetch(`/api/specs/${spec.name}`);
            const detail = await detailResponse.json();
            return { ...spec, statuses: detail.statuses };
          } catch {
            return spec;
          }
        })
      );
      setSpecs(withStatuses);
    } catch (error) {
      console.error("Failed to load specs:", error);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSpecs(); }, [loadSpecs]);

  return (
    <div className="min-h-screen bg-[--color-bg]">
      <header className="border-b-4 border-black bg-white">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-3xl font-black uppercase tracking-tight hover:underline">
              DevFlow
            </Link>
            <nav className="flex gap-4">
              <Link href="/" className="font-bold uppercase text-sm hover:underline">Board</Link>
              <span className="font-bold uppercase text-sm border-b-4 border-black">Specs</span>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <h2 className="text-2xl font-black uppercase mb-6">Specs</h2>

        {specs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-lg font-bold text-gray-500">No specs yet.</p>
            <p className="text-sm text-gray-400 mt-2">
              Use the MCP tools to create a spec: <code className="font-mono bg-gray-100 px-1">create_spec</code>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {specs.map((spec) => (
              <SpecCard
                key={spec.name}
                name={spec.name}
                title={spec.title}
                statuses={spec.statuses || []}
                createdAt={spec.createdAt}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
