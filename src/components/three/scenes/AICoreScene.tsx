import { SceneContainer } from "@/components/three/SceneContainer";
import { AICore } from "@/components/three/AICore";
import { ParticleField3D } from "@/components/three/ParticleField3D";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import type { DeviceTier } from "@/lib/device-tier";

export interface AICoreSceneProps {
  className?: string | undefined;
}

function AICoreSceneContents({ tier, reducedMotion }: { tier: DeviceTier; reducedMotion: boolean }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={1.2} color="#d4af37" />
      <pointLight position={[-5, -3, -5]} intensity={0.6} color="#40e0d0" />
      <AICore tier={tier} reducedMotion={reducedMotion} />
      <ParticleField3D tier={tier} reducedMotion={reducedMotion} />
    </>
  );
}

export default function AICoreScene({ className }: AICoreSceneProps) {
  const { tier, reducedMotion } = useDeviceTier();

  return (
    <SceneContainer className={className}>
      <AICoreSceneContents tier={tier} reducedMotion={reducedMotion} />
    </SceneContainer>
  );
}
