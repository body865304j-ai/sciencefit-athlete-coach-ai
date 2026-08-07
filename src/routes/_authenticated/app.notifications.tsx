import { createFileRoute } from "@tanstack/react-router";
import { NotificationsScreen } from "@/components/screens/NotificationsScreen";

export const Route = createFileRoute("/_authenticated/app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — ScienceFit" },
      {
        name: "description",
        content:
          "Challenge invitations, deadline reminders, evaluation results and performance score updates in one place.",
      },
      { property: "og:title", content: "Notifications — ScienceFit" },
      {
        property: "og:description",
        content: "Every ScienceFit challenge and evaluation update in one feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <NotificationsScreen />,
});
