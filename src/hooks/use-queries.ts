'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Task, Project } from '@/db/schema';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useProjects() {
  return useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => fetchJson('/api/projects'),
    refetchInterval: 5000,
  });
}

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => fetchJson('/api/tasks'),
    refetchInterval: 5000,
  });
}

export function useSpec(name: string) {
  return useQuery({
    queryKey: ['spec', name],
    queryFn: () => fetchJson<Record<string, unknown>>(`/api/specs/${name}`),
    refetchInterval: 3000,
    enabled: !!name,
  });
}

export function useSpecs() {
  return useQuery({
    queryKey: ['specs'],
    queryFn: async () => {
      const specs =
        await fetchJson<Array<{ name: string; title: string; createdAt: string }>>('/api/specs');
      // Fetch statuses for each spec in parallel
      const withStatuses = await Promise.all(
        specs.map(async (spec) => {
          try {
            const detail = await fetchJson<Record<string, unknown>>(`/api/specs/${spec.name}`);
            return { ...spec, statuses: detail.statuses };
          } catch {
            return spec;
          }
        }),
      );
      return withStatuses;
    },
    refetchInterval: 5000,
  });
}

export function useArtifact(specName: string, artifactType: string) {
  return useQuery({
    queryKey: ['artifact', specName, artifactType],
    queryFn: () =>
      fetchJson<{ content: string | null }>(`/api/specs/${specName}/artifacts/${artifactType}`),
    refetchInterval: 3000,
    enabled: !!specName && !!artifactType,
  });
}

export function useInvalidate() {
  const queryClient = useQueryClient();
  return {
    invalidateTasks: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    invalidateProjects: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    invalidateSpec: (name: string) => queryClient.invalidateQueries({ queryKey: ['spec', name] }),
    invalidateSpecs: () => queryClient.invalidateQueries({ queryKey: ['specs'] }),
    invalidateArtifact: (specName: string, artifactType: string) =>
      queryClient.invalidateQueries({ queryKey: ['artifact', specName, artifactType] }),
    invalidateAll: () => queryClient.invalidateQueries(),
  };
}
