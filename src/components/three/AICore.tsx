import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_QUALITY } from "@/components/three/scene-config";
import type { DeviceTier } from "@/lib/device-tier";

const CHAMPAGNE_GOLD = "#d4af37";
const SOFT_CYAN = "#40e0d0";

export interface AICoreProps {
  tier: DeviceTier;
  reducedMotion: boolean;
  scale?: number;
}

/**
 * Abstract geometric AI Core (Design Constitution 10.1): three intersecting
 * torus rings in champagne gold metallic on different axes, plus a central
 * emissive energy sphere that slowly pulses.
 */
export function AICore({ tier, reducedMotion, scale = 1 }: AICoreProps) {
  const segments = SCENE_QUALITY[tier].coreSegments;
  const groupRef = useRef<THREE.Group>(null);
  const sphereMaterialRef = useRef<THREE.MeshStandardMaterial>(null);

  const ringGeometryArgs = useMemo<[number, number, number, number]>(
    () => [1, 0.08, segments.ringRadialSegments, segments.ringTubularSegments],
    [segments.ringRadialSegments, segments.ringTubularSegments],
  );

  useFrame((state, delta) => {
    if (reducedMotion) return;
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.rotation.x += delta * 0.05;
    }
    if (sphereMaterialRef.current) {
      const pulse = 0.6 + Math.sin(state.clock.elapsedTime * 1.5) * 0.4;
      sphereMaterialRef.current.emissiveIntensity = pulse;
    }
  });

  return (
    <group ref={groupRef} scale={scale}>
      <mesh rotation={[0, 0, 0]}>
        <torusGeometry args={ringGeometryArgs} />
        <meshStandardMaterial color={CHAMPAGNE_GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={ringGeometryArgs} />
        <meshStandardMaterial color={CHAMPAGNE_GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 3]}>
        <torusGeometry args={ringGeometryArgs} />
        <meshStandardMaterial color={CHAMPAGNE_GOLD} metalness={0.9} roughness={0.25} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.4, segments.sphereWidthSegments, segments.sphereHeightSegments]} />
        <meshStandardMaterial
          ref={sphereMaterialRef}
          color={SOFT_CYAN}
          emissive={SOFT_CYAN}
          emissiveIntensity={0.6}
          metalness={0.2}
          roughness={0.3}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
