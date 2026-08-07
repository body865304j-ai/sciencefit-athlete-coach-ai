import { createFileRoute } from "@tanstack/react-router";
import { ChallengeDetailScreen } from "@/components/screens/ChallengeDetailScreen";

export const Route = createFileRoute("/_authenticated/app/challenges/$challengeId/")({
  head: () => ({
    meta: [
      { title: "Challenge — ScienceFit" },
      {
        name: "description",
        content:
          "Challenge brief, deadline, invited coaches and submission state for this anonymous coaching challenge.",
      },
      { property: "og:title", content: "Challenge — ScienceFit" },
      {
        property: "og:description",
        content: "Brief, deadline and submission state for this coaching challenge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { challengeId } = Route.useParams();
  return <ChallengeDetailScreen challengeId={challengeId} />;
}
