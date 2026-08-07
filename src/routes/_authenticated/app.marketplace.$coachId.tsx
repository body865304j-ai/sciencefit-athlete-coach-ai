import { createFileRoute } from "@tanstack/react-router";
import { CoachPublicProfileScreen } from "@/components/screens/CoachPublicProfileScreen";

export const Route = createFileRoute("/_authenticated/app/marketplace/$coachId")({
  head: () => ({
    meta: [
      { title: "Coach profile — ScienceFit" },
      {
        name: "description",
        content:
          "View a coach's public marketplace profile, Performance Score history and certifications.",
      },
      { property: "og:title", content: "Coach profile — ScienceFit" },
      {
        property: "og:description",
        content: "Performance Score, specializations and certifications for this coach.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => {
    const { coachId } = Route.useParams();
    return <CoachPublicProfileScreen coachId={coachId} />;
  },
});
