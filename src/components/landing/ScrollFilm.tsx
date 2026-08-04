import { useEffect, useRef, useState, type ReactNode } from "react";
import { useDeviceTier } from "@/hooks/useDeviceTier";

/**
 * Scroll film primitives.
 *
 * Scroll position maps directly to the animation timeline (scrubbing).
 * Nothing autoplays. Every chapter is a full viewport section.
 */

/** Returns 0 -> 1 as the element travels through the viewport. */
export function useScrubProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const total = rect.height + window.innerHeight;
      const travelled = window.innerHeight - rect.top;
      setProgress(Math.min(1, Math.max(0, travelled / total)));
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { ref, progress };
}

export type ChapterTransition =
  | "morph"
  | "dissolve"
  | "particle-flow"
  | "scale-shift"
  | "color-transition";

interface ChapterProps {
  id: string;
  index: number;
  eyebrow: string;
  title: string;
  body: string;
  transition: ChapterTransition;
  pinned?: boolean;
  children?: ReactNode;
}

export function Chapter({
  id,
  index,
  eyebrow,
  title,
  body,
  transition,
  pinned = false,
  children,
}: ChapterProps) {
  const { ref, progress } = useScrubProgress<HTMLElement>();
  const { reducedMotion, tier } = useDeviceTier();
  const still = reducedMotion || tier === "C";

  // power2.out entrance, scrubbed with easing none against scroll position.
  const enter = Math.min(1, Math.max(0, (progress - 0.12) / 0.34));
  const eased = 1 - Math.pow(1 - enter, 2);
  const exit = Math.min(1, Math.max(0, (progress - 0.76) / 0.24));

  const style = still
    ? undefined
    : ({
        opacity:
          transition === "dissolve" || transition === "color-transition"
            ? eased * (1 - exit * 0.85)
            : eased,
        transform:
          transition === "scale-shift"
            ? `scale(${0.94 + eased * 0.06})`
            : transition === "morph"
              ? `translate3d(0, ${(1 - eased) * 36}px, 0)`
              : `translate3d(0, ${(1 - eased) * 18}px, 0)`,
      } as const);

  return (
    <section
      ref={ref}
      id={id}
      aria-labelledby={`${id}-title`}
      className={`relative flex min-h-dvh w-full items-center overflow-hidden ${
        pinned ? "md:sticky md:top-0" : ""
      }`}
      data-transition={transition}
    >
      <div className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <div style={style} className="max-w-2xl">
          <p className="text-data text-[0.7rem] uppercase tracking-[0.34em] text-primary">
            <span aria-hidden="true">
              {String(index).padStart(2, "0")} &mdash;{" "}
            </span>
            {eyebrow}
          </p>
          <h2
            id={`${id}-title`}
            className="mt-6 font-display text-4xl font-light leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            {title}
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {body}
          </p>
        </div>
        {children ? <div className="mt-14">{children}</div> : null}
      </div>
    </section>
  );
}

/** Ambient drifting particles. Disabled entirely on Tier C. */
export function ParticleField() {
  const { tier, reducedMotion } = useDeviceTier();
  if (tier === "C" || reducedMotion) return null;

  const count = tier === "A" ? 28 : 12;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          className="ambient-drift absolute block size-px rounded-full bg-primary"
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${(index * 53) % 100}%`,
            opacity: 0.18 + ((index % 5) * 0.08),
            animationDelay: `${(index % 7) * 1.3}s`,
          }}
        />
      ))}
    </div>
  );
}
