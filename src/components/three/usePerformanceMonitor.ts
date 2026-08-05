import { useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

const RING_SIZE = 60;
const DEGRADE_SECONDS = 3;

export interface PerformanceMonitorResult {
  fps: number;
  degraded: boolean;
}

/**
 * Samples frame deltas via useFrame and computes a rolling median FPS over
 * ~60 frames. If fps stays under 80% of the tier's target for 3 consecutive
 * seconds, `degraded` flips to true so scenes can cut particles/effects.
 * Allocation-light: reuses a fixed-size ring buffer, no per-frame arrays.
 */
export function usePerformanceMonitor(targetFps: number): PerformanceMonitorResult {
  const buffer = useMemo(() => new Float32Array(RING_SIZE), []);
  const sorted = useMemo(() => new Float32Array(RING_SIZE), []);
  const writeIndex = useRef(0);
  const filled = useRef(0);
  const underBudgetSeconds = useRef(0);
  const [fps, setFps] = useState(targetFps);
  const [degraded, setDegraded] = useState(false);

  useFrame((_, delta) => {
    if (delta <= 0) return;
    const instantFps = 1 / delta;

    buffer[writeIndex.current] = instantFps;
    writeIndex.current = (writeIndex.current + 1) % RING_SIZE;
    if (filled.current < RING_SIZE) filled.current += 1;

    const count = filled.current;
    for (let i = 0; i < count; i++) {
      sorted[i] = buffer[i] ?? 0;
    }
    const view = sorted.subarray(0, count);
    view.sort();
    const median = view[Math.floor(count / 2)] ?? instantFps;

    setFps((prev) => (Math.abs(prev - median) > 0.5 ? median : prev));

    const threshold = targetFps * 0.8;
    if (median < threshold) {
      underBudgetSeconds.current += delta;
    } else {
      underBudgetSeconds.current = 0;
      if (degraded) setDegraded(false);
    }

    if (!degraded && underBudgetSeconds.current >= DEGRADE_SECONDS) {
      setDegraded(true);
    }
  });

  return { fps, degraded };
}
