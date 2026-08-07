import { createFileRoute } from "@tanstack/react-router";
import { ChallengeResultsScreen } from "@/components/screens/ChallengeResultsScreen";

export const Route = createFileRoute("/_authenticated/app/challenges/$challengeId/results")({
  head: () => ({
    meta: [
      { title: "Challenge results — ScienceFit" },
      {
        name: "description",
        content:
          "Anonymous ranked results for this challenge, including tie-breaker resolution and per-dimension scores.",
      },
      { property: "og:title", content: "Challenge results — ScienceFit" },
      {
        property: "og:description",
        content: "Anonymous ranked results and tie-breaker resolution for this challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { challengeId } = Route.useParams();
  return <ChallengeResultsScreen challengeId={challengeId} />;
}
