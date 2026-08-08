import { Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from "@react-three/drei";
import { SCENE_QUALITY } from "@/components/three/scene-config";
import { useDeviceTier } from "@/hooks/useDeviceTier";

export interface SceneContainerProps {
  children: ReactNode;
  className?: string | undefined;
  camera?:
    | {
        position: [number, number, number];
        fov: number;
      }
    | undefined;
}

const DEFAULT_CAMERA: NonNullable<SceneContainerProps["camera"]> = {
  position: [0, 0, 6],
  fov: 50,
};

/**
 * The R3F root. Configures Canvas quality from SCENE_QUALITY[tier] and
 * renders nothing on Tier C — callers own the CSS fallback in that case.
 */
export function SceneContainer({
  children,
  className,
  camera = DEFAULT_CAMERA,
}: SceneContainerProps) {
  const { tier, reducedMotion } = useDeviceTier();

  if (tier === "C") return null;

  const quality = SCENE_QUALITY[tier];

  return (
    <Canvas
      className={className}
      dpr={quality.dpr}
      shadows={quality.shadows}
      frameloop={reducedMotion ? "demand" : "always"}
      gl={{
        antialias: quality.antialias,
        powerPreference: "high-performance",
      }}
      camera={camera}
      onCreated={({ scene }) => {
        scene.matrixWorldAutoUpdate = true;
        scene.traverse((object) => {
          object.frustumCulled = true;
        });
      }}
    >
      <PerformanceMonitor>
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Suspense fallback={null}>{children}</Suspense>
      </PerformanceMonitor>
    </Canvas>
  );
}
