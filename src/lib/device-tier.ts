/**
 * Device tier detection (Tier A / B / C adaptive rendering).
 *
 * Source of truth: ENGINEERING_PRINCIPLES.md Section 5.2 (Device Tier
 * Detection) and Section 4.2 (Performance Budgets).
 */

export type DeviceTier = "A" | "B" | "C";

/** ENGINEERING_PRINCIPLES.md 4.2 — per-tier performance budgets. */
export const TIER_BUDGETS: Record<
  DeviceTier,
  {
    jsKb: number;
    cssKb: number;
    modelMb: number;
    imageFormat: string;
    fcpSeconds: number;
    lcpSeconds: number;
    targetFps: number;
    transport: string;
  }
> = {
  A: {
    jsKb: 200,
    cssKb: 50,
    modelMb: 2,
    imageFormat: "AVIF, 2x retina",
    fcpSeconds: 1.0,
    lcpSeconds: 1.5,
    targetFps: 60,
    transport: "uncompressed JSON",
  },
  B: {
    jsKb: 150,
    cssKb: 40,
    modelMb: 1,
    imageFormat: "WebP, 1.5x",
    fcpSeconds: 1.5,
    lcpSeconds: 2.5,
    targetFps: 60,
    transport: "Gzip JSON",
  },
  C: {
    jsKb: 100,
    cssKb: 30,
    modelMb: 0,
    imageFormat: "JPEG 80%, max 800px",
    fcpSeconds: 2.5,
    lcpSeconds: 4.0,
    targetFps: 30,
    transport: "Brotli + MessagePack",
  },
};

export const TIER_CAPABILITIES: Record<DeviceTier, string> = {
  A: "Full cinematic: 3D world map, GSAP scroll animations, particle systems.",
  B: "Simplified 3D, reduced particle counts, lighter shaders.",
  C: "Ultra-light: static imagery and CSS animations only. No 3D.",
};

interface NavigatorWithTierSignals extends Navigator {
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * ENGINEERING_PRINCIPLES.md 5.2.
 *
 *   Tier A: cores >= 8 AND memory >= 8 AND WebGL AND effectiveType === '4g'
 *           AND !saveData
 *   Tier B: cores >= 4 AND memory >= 4 AND WebGL AND effectiveType !== '2g'
 *           AND !saveData
 *   Tier C: everything else
 *
 * prefers-reduced-motion caps the result at Tier B — it never forces Tier C,
 * because reduced motion is a motion preference, not a capability signal.
 *
 * Must only be called in the browser (useEffect / event handler).
 */
export function detectDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "C";

  const nav = navigator as NavigatorWithTierSignals;
  const cores = nav.hardwareConcurrency ?? 2;
  const memory = nav.deviceMemory ?? 2;
  const webgl = hasWebGL();
  const effectiveType = nav.connection?.effectiveType ?? "4g";
  const saveData = nav.connection?.saveData ?? false;

  let tier: DeviceTier = "C";
  if (webgl && !saveData && cores >= 8 && memory >= 8 && effectiveType === "4g") {
    tier = "A";
  } else if (
    webgl &&
    !saveData &&
    cores >= 4 &&
    memory >= 4 &&
    effectiveType !== "2g" &&
    effectiveType !== "slow-2g"
  ) {
    tier = "B";
  }

  if (tier === "A" && prefersReducedMotion()) tier = "B";
  return tier;
}

export const TIER_STORAGE_KEY = "sciencefit.device-tier";

/** Manual override from Settings, if the athlete pinned a tier. */
export function readTierOverride(): DeviceTier | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(TIER_STORAGE_KEY);
  return value === "A" || value === "B" || value === "C" ? value : null;
}

export function writeTierOverride(tier: DeviceTier | null) {
  if (typeof window === "undefined") return;
  if (tier === null) window.localStorage.removeItem(TIER_STORAGE_KEY);
  else window.localStorage.setItem(TIER_STORAGE_KEY, tier);
}
