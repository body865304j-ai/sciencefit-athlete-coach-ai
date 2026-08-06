import { createFileRoute } from "@tanstack/react-router";
import { RequestWizardScreen } from "@/components/screens/RequestWizardScreen";

export const Route = createFileRoute("/_authenticated/app/requests/new")({
  head: () => ({
    meta: [
      { title: "New training request — ScienceFit" },
      {
        name: "description",
        content:
          "Describe your goal, equipment, experience and availability to open an anonymous coaching challenge.",
      },
      { property: "og:title", content: "New training request — ScienceFit" },
      {
        property: "og:description",
        content: "Open an anonymous coaching challenge in a few guided steps.",
      },
    ],
  }),
  component: () => <RequestWizardScreen />,
});
