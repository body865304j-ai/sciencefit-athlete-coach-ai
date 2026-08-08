import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Chapter, ParticleField } from "@/components/landing/ScrollFilm";
import { WorldMap } from "@/components/landing/WorldMap";
import { LazyAICoreScene, LazyGlobeScene } from "@/components/three/LazyScene";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { EVALUATION_DIMENSIONS, PERFORMANCE_TIERS } from "@/lib/domain";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ScienceFit — Anonymous Coaching Challenges, Scored by Science" },
      {
        name: "description",
        content:
          "Athletes post a training request. Coaches compete anonymously. Every program is scored on seven evidence-based dimensions before a winner is delivered.",
      },
      {
        property: "og:title",
        content: "ScienceFit — Anonymous Coaching Challenges, Scored by Science",
      },
      {
        property: "og:description",
        content:
          "Athletes post a training request. Coaches compete anonymously. Every program is scored on seven evidence-based dimensions before a winner is delivered.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { tier, reducedMotion } = useDeviceTier();

  // Smooth scroll is required for the scroll film, but never on Tier C
  // (minimal JS) and never against prefers-reduced-motion.
  useEffect(() => {
    if (tier === "C" || reducedMotion) return;
    let raf = 0;
    let destroy: (() => void) | undefined;

    void import("lenis").then(({ default: Lenis }) => {
      const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
      const loop = (time: number) => {
        lenis.raf(time);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      destroy = () => {
        cancelAnimationFrame(raf);
        lenis.destroy();
      };
    });

    return () => destroy?.();
  }, [tier, reducedMotion]);

  return (
    <main className="relative bg-background">
      {/* No traditional header navigation during the landing scroll film. */}
      <a
        href="#chapter-dashboard"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
      >
        Skip to sign in
      </a>

      {/* Chapter 01 — Hero */}
      <section
        aria-labelledby="hero-title"
        className="relative flex min-h-dvh items-center overflow-hidden"
      >
        <ParticleField />
        {/* Tier A/B: real-time globe. Tier C: static CSS/SVG map fallback. */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.55]">
          {tier === "C" ? (
            <WorldMap className="w-[190%] max-w-none sm:w-[130%] lg:w-[105%]" />
          ) : (
            <LazyGlobeScene className="!absolute inset-0 h-full w-full" />
          )}
        </div>
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
          <p className="text-data text-[0.7rem] uppercase tracking-[0.34em] text-primary">
            01 &mdash; ScienceFit
          </p>
          <h1
            id="hero-title"
            className="mt-6 max-w-4xl font-display text-[2.75rem] font-light leading-[1.02] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
          >
            Coaching, decided by
            <span className="text-primary"> evidence</span>.
          </h1>
          <p className="mt-7 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            An athlete describes what they need. Coaches around the world answer anonymously. Seven
            weighted dimensions decide whose program wins.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="tap-target inline-flex items-center justify-center rounded-md bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
            >
              Enter ScienceFit
            </Link>
            <a
              href="#chapter-evaluation"
              className="tap-target inline-flex items-center justify-center rounded-md border border-border px-7 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
            >
              How scoring works
            </a>
          </div>
        </div>
      </section>

      <Chapter
        id="chapter-athlete"
        index={2}
        eyebrow="The Athlete"
        transition="morph"
        title="It starts with an honest brief."
        body="Goal, experience, days available, equipment on hand, and anything an injury history demands. The request is validated before a single coach ever sees it."
      />

      <Chapter
        id="chapter-challenge"
        index={3}
        eyebrow="The Challenge"
        transition="scale-shift"
        title="One request becomes exactly one challenge."
        body="A deadline is set and it never moves. Coaches are invited, each may submit once, and every submission stays sealed until the window closes."
      />

      <Chapter
        id="chapter-competition"
        index={4}
        eyebrow="The Competition"
        transition="particle-flow"
        title="Coaches compete without names."
        body="Identity is cryptographically stripped and replaced with a per-challenge hash before evaluation begins. Reputation cannot buy a better score."
      >
        {/* Tier A/B: the abstract AI Core. Tier C: CSS particle fallback. */}
        {tier === "C" ? (
          <ParticleField />
        ) : (
          <div className="relative h-[42vh] w-full" aria-hidden="true">
            <LazyAICoreScene className="!absolute inset-0 h-full w-full" />
          </div>
        )}
      </Chapter>

      <Chapter
        id="chapter-evaluation"
        index={5}
        eyebrow="The Evaluation"
        transition="dissolve"
        title="Seven dimensions. Fixed weights."
        body="Each dimension returns a score, a confidence value, and reasoning attributed to specific parts of the program. Safety carries the most weight, and always will."
      >
        <ul className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {EVALUATION_DIMENSIONS.map((dimension) => (
            <li key={dimension.key} className="glass p-5">
              <p className="text-data text-xs text-primary">{dimension.weight.toFixed(1)}&times;</p>
              <p className="mt-2 text-sm font-medium text-foreground">{dimension.label}</p>
            </li>
          ))}
        </ul>
      </Chapter>

      <Chapter
        id="chapter-winner"
        index={6}
        eyebrow="The Winner"
        transition="color-transition"
        title="Ties break on safety first."
        body="If two programs score the same, the safer one wins. Then personalization. Then whoever submitted earlier. If everything is still level, both coaches win."
      />

      <Chapter
        id="chapter-reputation"
        index={7}
        eyebrow="Reputation"
        transition="morph"
        title="A Performance Score you earn, not claim."
        body="Results accumulate into a score that gates what a coach can access in the marketplace — and what athletes can see about them."
      >
        <ul className="flex flex-wrap gap-px overflow-hidden rounded-lg border border-border bg-border">
          {PERFORMANCE_TIERS.map((performanceTierItem) => (
            <li key={performanceTierItem.name} className="glass min-w-[8.5rem] flex-1 p-5">
              <p className="text-sm font-medium text-foreground">{performanceTierItem.name}</p>
              <p className="text-data mt-1 text-xs text-warm-gray">
                {performanceTierItem.min}&ndash;{performanceTierItem.max}
              </p>
            </li>
          ))}
        </ul>
      </Chapter>

      <Chapter
        id="chapter-dashboard"
        index={8}
        eyebrow="Your Dashboard"
        transition="scale-shift"
        title="Everything, in one quiet place."
        body="Track your request, watch the challenge run, read the reasoning behind every score, and take delivery of the winning program."
      >
        <Link
          to="/auth"
          className="tap-target inline-flex items-center justify-center rounded-md bg-primary px-7 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
        >
          Create your account
        </Link>
      </Chapter>

      <footer className="border-t border-border px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <p className="text-data text-xs uppercase tracking-[0.28em] text-warm-gray">ScienceFit</p>
          <p className="text-xs text-warm-gray">Rendering tier {tier} &middot; dark theme only</p>
        </div>
      </footer>
    </main>
  );
}
