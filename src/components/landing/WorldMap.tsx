import { useDeviceTier } from "@/hooks/useDeviceTier";

const CITIES = [
  { id: "sf", x: 128, y: 172, delay: 0 },
  { id: "nyc", x: 232, y: 168, delay: 0.6 },
  { id: "sao", x: 300, y: 322, delay: 1.4 },
  { id: "lon", x: 452, y: 138, delay: 0.9 },
  { id: "lag", x: 470, y: 262, delay: 2.1 },
  { id: "cai", x: 528, y: 190, delay: 1.1 },
  { id: "dxb", x: 574, y: 216, delay: 2.6 },
  { id: "mum", x: 630, y: 232, delay: 1.7 },
  { id: "sin", x: 706, y: 278, delay: 3.0 },
  { id: "tok", x: 790, y: 176, delay: 0.3 },
  { id: "syd", x: 812, y: 358, delay: 2.4 },
];

const SIGNALS: [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 5],
  [5, 6],
  [6, 8],
  [8, 9],
  [9, 10],
  [2, 4],
];

/**
 * Ambient world map: slow rotation, 4s city pulse cycle, connection signals
 * between cities. Tier C renders the same map with all motion disabled.
 */
export function WorldMap({ className }: { className?: string }) {
  const { tier, reducedMotion } = useDeviceTier();
  const still = tier === "C" || reducedMotion;

  return (
    <svg
      viewBox="0 0 940 460"
      className={className}
      role="img"
      aria-label="Global map of ScienceFit coach and athlete activity"
    >
      <defs>
        <radialGradient id="sf-glow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#d4af37" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#d4af37" stopOpacity="0" />
        </radialGradient>
      </defs>

      <g
        className={still ? undefined : "ambient-rotate"}
        style={{ transformOrigin: "470px 230px" }}
      >
        <ellipse cx="470" cy="230" rx="430" ry="212" fill="url(#sf-glow)" />
        <ellipse
          cx="470"
          cy="230"
          rx="430"
          ry="212"
          fill="none"
          stroke="#d4af37"
          strokeOpacity="0.14"
        />
        <ellipse
          cx="470"
          cy="230"
          rx="430"
          ry="106"
          fill="none"
          stroke="#d4af37"
          strokeOpacity="0.08"
        />
      </g>

      {SIGNALS.map(([a, b], index) => {
        const from = CITIES[a];
        const to = CITIES[b];
        if (!from || !to) return null;
        const midY = Math.min(from.y, to.y) - 42;
        return (
          <path
            key={`signal-${index}`}
            d={`M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${midY} ${to.x} ${to.y}`}
            fill="none"
            stroke="#d4af37"
            strokeOpacity={still ? 0.18 : 0.5}
            strokeWidth="1"
            className={still ? undefined : "ambient-signal"}
            style={still ? undefined : { animationDelay: `${index * 0.8}s` }}
          />
        );
      })}

      {CITIES.map((city) => (
        <g key={city.id}>
          <circle
            cx={city.x}
            cy={city.y}
            r="2.5"
            fill="#d4af37"
            className={still ? undefined : "ambient-pulse"}
            style={still ? undefined : { animationDelay: `${city.delay}s` }}
          />
          <circle cx={city.x} cy={city.y} r="1.4" fill="#f5f5f0" />
        </g>
      ))}
    </svg>
  );
}
