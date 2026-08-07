import { createFileRoute } from "@tanstack/react-router";
import { EvaluationScreen } from "@/components/screens/EvaluationScreen";

export const Route = createFileRoute("/_authenticated/app/evaluations/$evaluationId")({
  head: () => ({
    meta: [
      { title: "Evaluation explainability — ScienceFit" },
      {
        name: "description",
        content:
          "Per-dimension AI evaluation scores, weights, confidence bands and reasoning attributions for a submitted program.",
      },
      { property: "og:title", content: "Evaluation explainability — ScienceFit" },
      {
        property: "og:description",
        content: "Scores, weights, confidence and reasoning behind an AI evaluation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { evaluationId } = Route.useParams();
  return <EvaluationScreen evaluationId={evaluationId} />;
}
