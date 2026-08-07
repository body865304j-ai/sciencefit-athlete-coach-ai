import { createFileRoute } from "@tanstack/react-router";
import { RankingScreen } from "@/components/screens/RankingScreen";

export const Route = createFileRoute("/_authenticated/app/ranking")({
  head: () => ({
    meta: [
      { title: "Coach ranking — ScienceFit" },
      {
        name: "description",
        content:
          "The global coach leaderboard ranked by Performance Score, with your own score history and tier progress.",
      },
      { property: "og:title", content: "Coach ranking — ScienceFit" },
      {
        property: "og:description",
        content: "Global coach leaderboard ranked by Performance Score.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <RankingScreen />,
});
