import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { DeviceTierProvider } from "@/hooks/useDeviceTier";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-data text-xs uppercase tracking-[0.3em] text-warm-gray">404</p>
        <h1 className="mt-4 font-display text-3xl font-light text-foreground">Page not found</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          to="/"
          className="tap-target mt-8 inline-flex items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
        >
          Return to ScienceFit
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-xl font-light text-foreground">
          This page didn&apos;t load
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Something went wrong on our end.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="tap-target inline-flex items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-accent"
          >
            Try again
          </button>
          <a
            href="/"
            className="tap-target inline-flex items-center justify-center rounded-md border border-border px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "ScienceFit" },
      { name: "theme-color", content: "#030303" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "ScienceFit — Anonymous Coaching Challenges, Scored by Science" },
      {
        property: "og:title",
        content: "ScienceFit — Anonymous Coaching Challenges, Scored by Science",
      },
      {
        name: "twitter:title",
        content: "ScienceFit — Anonymous Coaching Challenges, Scored by Science",
      },
      {
        name: "description",
        content:
          "Athletes post a training request. Coaches compete anonymously. Every program is scored on seven evidence-based dimensions before a winner is delivered.",
      },
      {
        property: "og:description",
        content:
          "Athletes post a training request. Coaches compete anonymously. Every program is scored on seven evidence-based dimensions before a winner is delivered.",
      },
      {
        name: "twitter:description",
        content:
          "Athletes post a training request. Coaches compete anonymously. Every program is scored on seven evidence-based dimensions before a winner is delivered.",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe91acbff5deb21a7c24412e35255045/id-preview-6c3c4894--9c2eb813-ee06-49a5-b9dc-8dcb7efcc306.lovable.app-1786156512100.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fe91acbff5deb21a7c24412e35255045/id-preview-6c3c4894--9c2eb813-ee06-49a5-b9dc-8dcb7efcc306.lovable.app-1786156512100.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      {
        rel: "preconnect",
        href: "https://fonts.gstatic.com",
        crossOrigin: "anonymous",
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-tier="C">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(() => {
      void router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <QueryClientProvider client={queryClient}>
      <DeviceTierProvider>
        {/* Required: nested routes render here. */}
        <Outlet />
        <Toaster />
      </DeviceTierProvider>
    </QueryClientProvider>
  );
}
