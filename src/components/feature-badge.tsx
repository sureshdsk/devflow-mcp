"use client";

import { cn } from "@/lib/utils";
import { Feature } from "@/db/schema";

interface FeatureBadgeProps {
  feature: Feature;
  className?: string;
}

// Generate a consistent color based on feature name
function getFeatureColor(name: string): string {
  const colors = [
    "bg-blue-200 text-blue-800 border-blue-400",
    "bg-green-200 text-green-800 border-green-400",
    "bg-purple-200 text-purple-800 border-purple-400",
    "bg-pink-200 text-pink-800 border-pink-400",
    "bg-orange-200 text-orange-800 border-orange-400",
    "bg-cyan-200 text-cyan-800 border-cyan-400",
    "bg-lime-200 text-lime-800 border-lime-400",
    "bg-amber-200 text-amber-800 border-amber-400",
  ];

  // Hash the name to get a consistent color
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function FeatureBadge({ feature, className }: FeatureBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border-2 uppercase",
        getFeatureColor(feature.name),
        className
      )}
    >
      {feature.name}
    </span>
  );
}

// Badge for interrupted tasks
export function InterruptedBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border-2 bg-amber-200 text-amber-800 border-amber-500 uppercase",
        className
      )}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 9v4m0 4h.01M5.072 21h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 18c-.77 1.333.192 3 1.732 3z" />
      </svg>
      Interrupted
    </span>
  );
}
