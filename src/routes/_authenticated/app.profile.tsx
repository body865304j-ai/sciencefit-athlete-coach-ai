import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/components/screens/ProfileScreen";

export const Route = createFileRoute("/_authenticated/app/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ScienceFit" },
      {
        name: "description",
        content:
          "Manage your ScienceFit profile, avatar, athlete or coach details and privacy settings.",
      },
      { property: "og:title", content: "Profile — ScienceFit" },
      {
        property: "og:description",
        content: "Update your ScienceFit identity, credentials and privacy preferences.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <ProfileScreen />,
});
