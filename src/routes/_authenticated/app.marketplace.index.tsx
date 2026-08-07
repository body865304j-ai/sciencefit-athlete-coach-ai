import { createFileRoute } from "@tanstack/react-router";
import { MarketplaceScreen } from "@/components/screens/MarketplaceScreen";

export const Route = createFileRoute("/_authenticated/app/marketplace/")({
  head: () => ({
    meta: [
      { title: "Marketplace — ScienceFit" },
      {
        name: "description",
        content:
          "Browse verified coaches by Performance Score, message eligible coaches and manage your marketplace engagements.",
      },
      { property: "og:title", content: "Marketplace — ScienceFit" },
      {
        property: "og:description",
        content: "Discover coaches ranked by Performance Score and manage your engagements.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <MarketplaceScreen />,
});
