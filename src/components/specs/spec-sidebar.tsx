"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface SpecMeta {
  name: string;
  title: string;
  schema: string;
  createdAt: string;
}

interface SpecSidebarProps {
  selectedSpecName: string | null;
  onSelectSpec: (specName: string | null) => void;
}

export function SpecSidebar({ selectedSpecName, onSelectSpec }: SpecSidebarProps) {
  const [specs, setSpecs] = useState<SpecMeta[]>([]);

  useEffect(() => {
    fetch("/api/specs")
      .then((r) => r.json())
      .then(setSpecs)
      .catch(console.error);
  }, []);

  return (
    <aside className="w-56 border-r-4 border-black bg-white flex flex-col">
      <div className="px-4 py-3 border-b-4 border-black">
        <div className="flex items-center justify-between">
          <h3 className="font-black uppercase text-sm">Specs</h3>
          <Link
            href="/specs"
            className="text-xs font-bold underline hover:no-underline"
          >
            View All
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <button
          onClick={() => onSelectSpec(null)}
          className={`w-full text-left px-3 py-2 text-sm font-bold border-2 border-transparent mb-1 ${
            !selectedSpecName ? "bg-black text-white" : "hover:bg-gray-100"
          }`}
        >
          All Tasks
        </button>

        {specs.map((spec) => (
          <button
            key={spec.name}
            onClick={() => onSelectSpec(spec.name)}
            className={`w-full text-left px-3 py-2 text-sm font-bold border-2 border-transparent mb-1 truncate ${
              selectedSpecName === spec.name
                ? "bg-[--color-primary] border-black"
                : "hover:bg-gray-100"
            }`}
            title={spec.title}
          >
            {spec.title || spec.name}
          </button>
        ))}

        {specs.length === 0 && (
          <p className="text-xs text-gray-500 px-3 py-2">
            No specs yet.{" "}
            <Link href="/specs" className="underline">
              Create one
            </Link>
          </p>
        )}
      </div>
    </aside>
  );
}
