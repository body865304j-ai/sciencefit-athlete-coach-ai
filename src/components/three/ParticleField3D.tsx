import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SCENE_QUALITY } from "@/components/three/scene-config";
import type { DeviceTier } from "@/lib/device-tier";

const CHAMPAGNE_GOLD = new THREE.Color("#d4af37");

export interface ParticleField3DProps {
  tier: DeviceTier;
  reducedMotion: boolean;
  degraded?: boolean;
  spread?: number;
}

/**
 * GPU points field. A single BufferGeometry + PointsMaterial is built once;
 * drift is achieved by rotating the whole Points object per-frame rather
 * than rewriting per-particle attributes.
 */
export function ParticleField3D({
  tier,
  reducedMotion,
  degraded = false,
  spread = 30,
}: ParticleField3DProps) {
  const baseCount = SCENE_QUALITY[tier].particleCount;
  const count = degraded ? Math.floor(baseCount / 2) : baseCount;
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    if (count <= 0) return null;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread;
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count, spread]);

  useFrame((_, delta) => {
    if (reducedMotion || !pointsRef.current) return;
    pointsRef.current.rotation.y += delta * 0.02;
    pointsRef.current.rotation.x += delta * 0.008;
  });

  if (!geometry || count <= 0) return null;

  return (
    <points ref={pointsRef} geometry={geometry} frustumCulled>
      <pointsMaterial
        color={CHAMPAGNE_GOLD}
        size={0.06}
        sizeAttenuation
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
