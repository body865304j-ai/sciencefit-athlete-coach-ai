import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  detectDeviceTier,
  prefersReducedMotion,
  readTierOverride,
  writeTierOverride,
  type DeviceTier,
} from "@/lib/device-tier";

interface TierContextValue {
  tier: DeviceTier;
  detected: DeviceTier | null;
  override: DeviceTier | null;
  reducedMotion: boolean;
  setOverride: (tier: DeviceTier | null) => void;
}

const TierContext = createContext<TierContextValue>({
  tier: "C",
  detected: null,
  override: null,
  reducedMotion: false,
  setOverride: () => {},
});

/**
 * Renders Tier C on the server so the first paint is always the cheapest
 * variant, then upgrades once real capability signals are available.
 */
export function DeviceTierProvider({ children }: { children: ReactNode }) {
  const [detected, setDetected] = useState<DeviceTier | null>(null);
  const [override, setOverrideState] = useState<DeviceTier | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setDetected(detectDeviceTier());
    setOverrideState(readTierOverride());
    setReducedMotion(prefersReducedMotion());

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  const tier = override ?? detected ?? "C";

  useEffect(() => {
    document.documentElement.dataset["tier"] = tier;
  }, [tier]);

  const setOverride = useCallback((next: DeviceTier | null) => {
    writeTierOverride(next);
    setOverrideState(next);
  }, []);

  const value = useMemo(
    () => ({ tier, detected, override, reducedMotion, setOverride }),
    [tier, detected, override, reducedMotion, setOverride],
  );

  return <TierContext.Provider value={value}>{children}</TierContext.Provider>;
}

export function useDeviceTier() {
  return useContext(TierContext);
}
