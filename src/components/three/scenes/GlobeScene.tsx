import { SceneContainer } from "@/components/three/SceneContainer";
import { GlobeMesh } from "@/components/three/GlobeMesh";
import { ParticleField3D } from "@/components/three/ParticleField3D";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import type { DeviceTier } from "@/lib/device-tier";

export interface GlobeSceneProps {
  className?: string;
}

function GlobeSceneContents({ tier, reducedMotion }: { tier: DeviceTier; reducedMotion: boolean }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[6, 4, 6]} intensity={1} color="#d4af37" />
      <GlobeMesh reducedMotion={reducedMotion} />
      <ParticleField3D tier={tier} reducedMotion={reducedMotion} spread={20} />
    </>
  );
}

export default function GlobeScene({ className }: GlobeSceneProps) {
  const { tier, reducedMotion } = useDeviceTier();

  return (
    <SceneContainer className={className} camera={{ position: [0, 0, 5], fov: 45 }}>
      <GlobeSceneContents tier={tier} reducedMotion={reducedMotion} />
    </SceneContainer>
  );
}
