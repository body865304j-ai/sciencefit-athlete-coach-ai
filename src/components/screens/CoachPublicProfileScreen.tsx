import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, MapPin, MessageSquare, ShieldOff } from "lucide-react";
import { publicCoachQuery } from "@/lib/queries";
import { openConversation, requestHire } from "@/lib/profile.functions";
import { MARKETPLACE_GATES, performanceTier } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const hireSchema = z.object({
  goal: z.string().trim().min(3, "Describe your goal in at least 3 characters.").max(200),
  note: z.string().trim().max(1000).optional(),
});

function tierClass(score: number) {
  const tier = performanceTier(score);
  if (!tier) return "text-muted-foreground";
  switch (tier.name) {
    case "Master":
      return "text-champagne";
    case "Expert":
      return "text-lime";
    case "Proficient":
      return "text-cyan";
    case "Developing":
      return "text-muted-gold";
    default:
      return "text-muted-foreground";
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function HireDialog({ coachId }: { coachId: string }) {
  const queryClient = useQueryClient();
  const requestHireFn = useServerFn(requestHire);
  const [open, setOpen] = useState(false);
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ goal?: string; note?: string }>({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = hireSchema.safeParse({ goal, note: note || undefined });
    if (!parsed.success) {
      const fieldErrors: { goal?: string; note?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === "goal") fieldErrors.goal = issue.message;
        if (key === "note") fieldErrors.note = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await requestHireFn({
        data: { coachId, goal: parsed.data.goal, note: parsed.data.note ?? null },
      });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-hires"] });
      toast.success("Hire request sent.");
      setOpen(false);
      setGoal("");
      setNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send hire request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Request to hire</Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request to hire</DialogTitle>
            <DialogDescription>
              Share your goal so the coach can decide whether to accept.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hire-goal">Goal</Label>
              <Input
                id="hire-goal"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                placeholder="e.g. Improve 5k time ahead of regionals"
                aria-invalid={errors.goal !== undefined}
              />
              {errors.goal && <p className="text-xs text-destructive">{errors.goal}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="hire-note">Note (optional)</Label>
              <Textarea
                id="hire-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Anything else the coach should know"
                aria-invalid={errors.note !== undefined}
              />
              {errors.note && <p className="text-xs text-destructive">{errors.note}</p>}
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={busy}>
              {busy ? "Sending\u2026" : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CoachPublicProfileScreen({ coachId }: { coachId: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isPending, isError, error } = useQuery(publicCoachQuery(coachId));
  const openConversationFn = useServerFn(openConversation);
  const [messaging, setMessaging] = useState(false);

  if (isPending) {
    return (
      <div className="mx-auto max-w-3xl space-y-4" aria-busy="true">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="glass rounded-lg p-10 text-center">
          <ShieldOff className="mx-auto size-6 text-warm-gray" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "This coach's profile is not available."}
          </p>
        </div>
      </div>
    );
  }

  async function handleMessage() {
    setMessaging(true);
    try {
      await openConversationFn({ data: { coachId } });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-conversations"] });
      toast.success("Conversation started.");
      navigate({ to: "/app/marketplace" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start conversation.");
    } finally {
      setMessaging(false);
    }
  }

  const score = data.performanceScore ?? 0;
  const tier = performanceTier(data.performanceScore);
  const location = [data.city, data.country].filter(Boolean).join(", ");

  return (
    <TooltipProvider>
      <section aria-labelledby="coach-profile-title" className="mx-auto max-w-3xl space-y-6">
        <div className="glass rounded-lg p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Avatar className="size-16">
                <AvatarImage src={data.avatarUrl ?? undefined} alt="" />
                <AvatarFallback>{data.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h1 id="coach-profile-title" className="font-display text-2xl text-foreground">
                    {data.displayName}
                  </h1>
                  {data.verified && (
                    <BadgeCheck className="size-5 text-primary" aria-label="Verified coach" />
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {data.headline ?? "ScienceFit coach"}
                </p>
                {location && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-warm-gray">
                    <MapPin className="size-3" aria-hidden="true" />
                    {location}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-data text-3xl font-medium ${tierClass(score)}`}>{score}</p>
              <Badge variant="outline" className="mt-1">
                {tier?.name ?? "Unranked"}
              </Badge>
            </div>
          </div>

          {data.bio && <p className="mt-4 text-sm text-foreground">{data.bio}</p>}

          <div className="mt-4 flex flex-wrap gap-1">
            {data.specializations.map((item) => (
              <Badge key={item} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
            {data.sports.map((item) => (
              <Badge key={item} variant="outline" className="text-xs">
                {item}
              </Badge>
            ))}
          </div>

          <p className="mt-3 text-sm text-muted-foreground">
            {data.experienceYears ?? 0} years of experience
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            {data.canMessage ? (
              <Button onClick={() => void handleMessage()} disabled={messaging}>
                <MessageSquare className="size-4" aria-hidden="true" />
                {messaging ? "Opening\u2026" : "Message"}
              </Button>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button disabled>
                      <MessageSquare className="size-4" aria-hidden="true" />
                      Message
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Messaging requires a Performance Score of at least {MARKETPLACE_GATES.message}.
                </TooltipContent>
              </Tooltip>
            )}

            {data.canHire ? (
              <HireDialog coachId={coachId} />
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}>
                    <Button disabled variant="secondary">
                      Request to hire
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  Hiring requires a Performance Score of at least {MARKETPLACE_GATES.hire}.
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </div>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Performance Score history</CardTitle>
          </CardHeader>
          <CardContent>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No score history yet.</p>
            ) : (
              <div className="space-y-2">
                <div className="flex h-16 items-end gap-1" aria-hidden="true">
                  {data.history.map((point, index) => (
                    <div
                      key={index}
                      className="flex-1 rounded-t bg-primary/60"
                      style={{ height: `${Math.max(4, point.score)}%` }}
                    />
                  ))}
                </div>
                <ul className="text-data space-y-1 text-xs text-warm-gray">
                  {data.history
                    .slice()
                    .reverse()
                    .slice(0, 6)
                    .map((point, index) => (
                      <li key={index} className="flex justify-between">
                        <span>{formatDate(point.createdAt)}</span>
                        <span>{point.score}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Certifications</CardTitle>
          </CardHeader>
          <CardContent>
            {data.certifications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No certifications listed.</p>
            ) : (
              <ul className="space-y-2">
                {data.certifications.map((cert, index) => (
                  <li key={index} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">
                      {cert.name}
                      {cert.issuer ? ` \u2014 ${cert.issuer}` : ""}
                    </span>
                    {cert.year && <span className="text-xs text-warm-gray">{cert.year}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </TooltipProvider>
  );
}
