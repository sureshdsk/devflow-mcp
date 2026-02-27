'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useWebSocket() {
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let isUnmounted = false;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    function connect() {
      if (isUnmounted) return;

      try {
        const ws = new WebSocket(
          `ws://localhost:${process.env.NEXT_PUBLIC_DEVFLOW_WS_PORT || '3001'}`,
        );
        wsRef.current = ws;

        ws.onmessage = (event) => {
          const data = JSON.parse(event.data);
          if (data.type === 'agent_count') return;

          // Invalidate relevant queries based on event type
          if (data.type?.includes('project')) {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
          }

          if (data.type?.includes('task') || data.type?.includes('promote')) {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
          }

          if (data.type?.includes('spec') || data.type?.includes('artifact')) {
            queryClient.invalidateQueries({ queryKey: ['specs'] });
            if (data.specName) {
              queryClient.invalidateQueries({ queryKey: ['spec', data.specName] });
              if (data.artifactType) {
                queryClient.invalidateQueries({
                  queryKey: ['artifact', data.specName, data.artifactType],
                });
              }
            }
          }

          // For any task event, also refresh tasks
          queryClient.invalidateQueries({ queryKey: ['tasks'] });
        };

        ws.onerror = () => {};

        ws.onclose = () => {
          if (!isUnmounted) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch {
        if (!isUnmounted) {
          reconnectTimeout = setTimeout(connect, 3000);
        }
      }
    }

    connect();

    return () => {
      isUnmounted = true;
      clearTimeout(reconnectTimeout);
      wsRef.current?.close();
    };
  }, [queryClient]);
}
