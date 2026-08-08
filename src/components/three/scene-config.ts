/**
 * Tier-driven quality configuration for the ScienceFit 3D scene system.
 * Design Constitution 10.1 (AI Core triangle budgets) and 8.3 (parallax
 * layers) are encoded here so every scene reads from a single source.
 */

export type SceneQuality = {
  /** [min, max] device pixel ratio passed to <Canvas dpr>. */
  dpr: [number, number];
  antialias: boolean;
  shadows: boolean;
  particleCount: number;
  /** Segment counts for the AI Core's rings/sphere geometry. */
  coreSegments: {
    ringTubularSegments: number;
    ringRadialSegments: number;
    sphereWidthSegments: number;
    sphereHeightSegments: number;
  };
  textureSize: number;
  targetFps: number;
  maxLights: number;
  bloom: boolean;
};

export const SCENE_QUALITY: Record<"A" | "B" | "C", SceneQuality> = {
  A: {
    dpr: [1, 2],
    antialias: true,
    shadows: true,
    particleCount: 1200,
    // 3 rings * (tubular * radial * 2 tris) + sphere ≈ 5000 tris total.
    coreSegments: {
      ringTubularSegments: 48,
      ringRadialSegments: 16,
      sphereWidthSegments: 32,
      sphereHeightSegments: 24,
    },
    textureSize: 1024,
    targetFps: 60,
    maxLights: 4,
    bloom: true,
  },
  B: {
    dpr: [1, 1.5],
    antialias: false,
    shadows: false,
    particleCount: 400,
    // Roughly halved to land near 2000 tris total.
    coreSegments: {
      ringTubularSegments: 28,
      ringRadialSegments: 10,
      sphereWidthSegments: 16,
      sphereHeightSegments: 12,
    },
    textureSize: 512,
    targetFps: 60,
    maxLights: 2,
    bloom: false,
  },
  C: {
    dpr: [1, 1],
    antialias: false,
    shadows: false,
    particleCount: 0,
    coreSegments: {
      ringTubularSegments: 12,
      ringRadialSegments: 6,
      sphereWidthSegments: 8,
      sphereHeightSegments: 6,
    },
    textureSize: 256,
    targetFps: 30,
    maxLights: 1,
    bloom: false,
  },
};

export type ParallaxLayerName = "background" | "atmosphere" | "midground" | "foreground";

export const PARALLAX_LAYERS: Record<ParallaxLayerName, number> = {
  background: 0.3,
  atmosphere: 0.5,
  midground: 0.8,
  foreground: 1.0,
};

export const PARALLAX_LAYER_Z_RANGES: Record<ParallaxLayerName, [number, number]> = {
  background: [-100, -50],
  atmosphere: [-40, -20],
  midground: [-10, 0],
  foreground: [10, 50],
};
