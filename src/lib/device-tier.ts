/**
 * Device tier detection (Tier A / B / C adaptive rendering).
 *
 * Signals used are exactly those named in the brief:
 *   navigator.hardwareConcurrency, navigator.deviceMemory,
 *   WebGL support, navigator.connection.effectiveType,
 *   plus prefers-reduced-motion.
 *
 * TODO: Governance gap - the exact numeric thresholds that separate
 * Tier A / B / C are not stated in the brief and the Design Constitution
 * was not provided. The boundaries below are placeholders and MUST be
 * replaced with the governed values.
 * Requires clarification from Product Team / Design.
 */

export type DeviceTier = "A" | "B" | "C";

export const TIER_BUDGETS: Record<
  DeviceTier,
  {
    jsKb: number;
    cssKb: number;
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
    imageFormat: "AVIF, 2x retina",
    fcpSeconds: 1.0,
    lcpSeconds: 1.5,
    targetFps: 60,
    transport: "uncompressed JSON",
  },
  B: {
    jsKb: 150,
    cssKb: 40,
    imageFormat: "WebP, 1.5x",
    fcpSeconds: 1.5,
    lcpSeconds: 2.5,
    targetFps: 60,
    transport: "Gzip JSON",
  },
  C: {
    jsKb: 100,
    cssKb: 30,
    imageFormat: "JPEG 80%, max 800px",
    fcpSeconds: 2.5,
    lcpSeconds: 4.0,
    targetFps: 30,
    transport: "Brotli + MessagePack",
  },
};

interface NavigatorWithTierSignals extends Navigator {
  deviceMemory?: number;
  connection?: { effectiveType?: string; saveData?: boolean };
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ?? canvas.getContext("webgl"),
    );
  } catch {
    return false;
  }
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Must only be called in the browser (useEffect / event handler). */
export function detectDeviceTier(): DeviceTier {
  if (typeof window === "undefined") return "C";

  const nav = navigator as NavigatorWithTierSignals;
  const cores = nav.hardwareConcurrency ?? 2;
  const memory = nav.deviceMemory ?? 2;
  const webgl = hasWebGL();
  const effectiveType = nav.connection?.effectiveType ?? "4g";
  const saveData = nav.connection?.saveData ?? false;

  const slowNetwork =
    saveData || effectiveType === "2g" || effectiveType === "slow-2g";

  // Reduced motion never forces a lower tier (it is honoured separately in
  // CSS), so tiering stays purely a capability decision.
  if (!webgl || slowNetwork || cores <= 2 || memory <= 2) return "C";
  if (cores >= 8 && memory >= 8 && effectiveType === "4g") return "A";
  return "B";
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
