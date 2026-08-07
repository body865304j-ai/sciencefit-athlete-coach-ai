import { createFileRoute } from "@tanstack/react-router";
import { SettingsScreen } from "@/components/screens/SettingsScreen";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ScienceFit" },
      {
        name: "description",
        content:
          "Appearance, accessibility, notification and account preferences for your ScienceFit account.",
      },
      { property: "og:title", content: "Settings — ScienceFit" },
      {
        property: "og:description",
        content: "Manage how ScienceFit looks, notifies you, and keeps your account secure.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <SettingsScreen />,
});
