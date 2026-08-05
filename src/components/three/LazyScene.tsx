import { lazy, useEffect, useState, type ReactNode } from "react";
import { useDeviceTier } from "@/hooks/useDeviceTier";

/**
 * Renders children only after the component has mounted on the client,
 * avoiding any SSR mismatch for hydration-gated 3D content.
 */
export function Hydrated({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  if (!hydrated) return null;
  return <>{children}</>;
}

const AICoreSceneLazy = lazy(() => import("@/components/three/scenes/AICoreScene"));
const GlobeSceneLazy = lazy(() => import("@/components/three/scenes/GlobeScene"));

export interface LazySceneProps {
  className?: string;
}

/**
 * Only SSR-safe entry point for the AI Core scene. Dynamically imports
 * three.js/R3F so it stays out of the initial bundle, and mounts only after
 * hydration and only when the device tier supports it.
 */
export function LazyAICoreScene({ className }: LazySceneProps) {
  const { tier } = useDeviceTier();

  if (tier === "C") return null;

  return (
    <Hydrated>
      <AICoreSceneLazy className={className} />
    </Hydrated>
  );
}

/**
 * Only SSR-safe entry point for the Globe scene. Same lazy/tier-gated
 * pattern as LazyAICoreScene.
 */
export function LazyGlobeScene({ className }: LazySceneProps) {
  const { tier } = useDeviceTier();

  if (tier === "C") return null;

  return (
    <Hydrated>
      <GlobeSceneLazy className={className} />
    </Hydrated>
  );
}
