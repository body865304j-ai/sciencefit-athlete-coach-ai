import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { viewerQuery } from "@/lib/queries";
import { chooseRole } from "@/lib/flow.functions";
import { AthleteDashboardScreen } from "@/components/screens/AthleteDashboardScreen";
import { CoachDashboardScreen } from "@/components/screens/CoachDashboardScreen";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard — ScienceFit" },
      {
        name: "description",
        content:
          "Track your ScienceFit requests, challenges, programs and evaluation results in one place.",
      },
      { property: "og:title", content: "Dashboard — ScienceFit" },
      {
        property: "og:description",
        content: "Your ScienceFit athlete or coach workspace.",
      },
    ],
  }),
  component: DashboardRoute,
});

function DashboardRoute() {
  const queryClient = useQueryClient();
  const { data: viewer, isPending } = useQuery(viewerQuery);
  const pickRole = useServerFn(chooseRole);
  const [busy, setBusy] = useState(false);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const roles = viewer?.roles ?? [];
  const isCoach = roles.includes("coach");
  const isAthlete = roles.includes("athlete");

  async function select(role: "athlete" | "coach") {
    setBusy(true);
    try {
      await pickRole({ data: { role } });
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set your role.");
    } finally {
      setBusy(false);
    }
  }

  if (!isCoach && !isAthlete) {
    return (
      <section aria-labelledby="role-title" className="mx-auto max-w-2xl">
        <h1 id="role-title" className="font-display text-2xl font-light text-foreground">
          How will you use ScienceFit?
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Athletes post a training request. Coaches compete anonymously to answer it.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="glass rounded-lg p-6">
            <h2 className="text-sm font-medium text-foreground">Athlete</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create a request and receive the winning program.
            </p>
            <Button className="mt-5 w-full" disabled={busy} onClick={() => void select("athlete")}>
              Continue as athlete
            </Button>
          </div>
          <div className="glass rounded-lg p-6">
            <h2 className="text-sm font-medium text-foreground">Coach</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Enter challenges and build programs for evaluation.
            </p>
            <Button
              className="mt-5 w-full"
              variant="outline"
              disabled={busy}
              onClick={() => void select("coach")}
            >
              Continue as coach
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (isCoach && !isAthlete) return <CoachDashboardScreen />;
  if (isAthlete && !isCoach) return <AthleteDashboardScreen />;

  return (
    <div className="space-y-12">
      <AthleteDashboardScreen />
      <CoachDashboardScreen />
    </div>
  );
}
