'use client';

import { useCallback } from 'react';
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('roadmap-frontend', '1.0.0');

export function useTrace() {
  const startSpan = useCallback((name: string) => {
    return tracer.startSpan(name);
  }, []);

  return { startSpan };
}
