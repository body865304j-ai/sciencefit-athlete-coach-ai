import { createFileRoute } from "@tanstack/react-router";
import { ProgramBuilderScreen } from "@/components/screens/ProgramBuilderScreen";

export const Route = createFileRoute("/_authenticated/app/challenges/$challengeId/builder")({
  head: () => ({
    meta: [
      { title: "Program builder — ScienceFit" },
      {
        name: "description",
        content:
          "Build and submit an anonymous training program: weeks, days, exercises, load notes and coaching cues.",
      },
      { property: "og:title", content: "Program builder — ScienceFit" },
      {
        property: "og:description",
        content: "Build and submit an anonymous training program for this challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { challengeId } = Route.useParams();
  return <ProgramBuilderScreen challengeId={challengeId} />;
}
