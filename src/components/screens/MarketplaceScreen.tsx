import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { BadgeCheck, MessageSquare, Search, Send, ShieldCheck, Users } from "lucide-react";
import { coachSearchQuery, conversationsQuery, hiresQuery, messagesQuery } from "@/lib/queries";
import { sendMessage, respondToHire } from "@/lib/profile.functions";
import type { MarketplaceFilters } from "@/lib/marketplace-filters";
import { MARKETPLACE_GATES, performanceTier } from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const messageSchema = z.object({
  body: z.string().trim().min(1, "Write a message first.").max(2000),
});

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

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

function formatWhen(value: string | null) {
  if (!value) return "\u2014";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CoachCard({
  coach,
}: {
  coach: {
    coachId: string;
    displayName: string;
    headline: string | null;
    avatarUrl: string | null;
    performanceScore: number;
    specializations: string[];
    sports: string[];
    experienceYears: number | null;
    certificationCount: number;
    verified: boolean;
  };
}) {
  const tier = performanceTier(coach.performanceScore);
  return (
    <Card className="glass flex flex-col">
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <Avatar className="size-12 shrink-0">
          <AvatarImage src={coach.avatarUrl ?? undefined} alt="" />
          <AvatarFallback>{coach.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-base">{coach.displayName}</CardTitle>
            {coach.verified ? (
              <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Verified coach" />
            ) : null}
          </div>
          <CardDescription className="truncate">
            {coach.headline ?? "ScienceFit coach"}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className={`text-data text-lg font-medium ${tierClass(coach.performanceScore)}`}>
            {coach.performanceScore}
          </span>
          <Badge variant="outline">{tier?.name ?? "Unranked"}</Badge>
        </div>
        <div className="flex flex-wrap gap-1">
          {coach.specializations.slice(0, 4).map((s) => (
            <Badge key={s} variant="secondary" className="text-xs">
              {s}
            </Badge>
          ))}
          {coach.sports.slice(0, 3).map((s) => (
            <Badge key={s} variant="outline" className="text-xs">
              {s}
            </Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {coach.experienceYears ?? 0} yrs experience · {coach.certificationCount} certification
          {coach.certificationCount === 1 ? "" : "s"}
        </p>
        <div className="mt-auto pt-2">
          <Button asChild size="sm" variant="outline" className="w-full">
            <Link to="/app/marketplace/$coachId" params={{ coachId: coach.coachId }}>
              View profile
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function BrowseSection() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 350);
  const [specialization, setSpecialization] = useState<string>("all");
  const [sport, setSport] = useState<string>("all");
  const [minScore, setMinScore] = useState<number>(MARKETPLACE_GATES.browse);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sort, setSort] = useState<"score" | "experience">("score");

  const filters: MarketplaceFilters = {
    query: debouncedQuery || undefined,
    specialization: specialization === "all" ? undefined : specialization,
    sport: sport === "all" ? undefined : sport,
    minScore,
    verifiedOnly: verifiedOnly || undefined,
    sort,
  };

  const { data, isPending, isError, refetch } = useQuery(coachSearchQuery(filters));
  const coaches = data?.coaches ?? [];
  const facets = data?.facets ?? { specializations: [], sports: [] };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warm-gray"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search coaches"
            placeholder="Search coaches"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={specialization} onValueChange={setSpecialization}>
          <SelectTrigger aria-label="Filter by specialization">
            <SelectValue placeholder="Specialization" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All specializations</SelectItem>
            {facets.specializations.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sport} onValueChange={setSport}>
          <SelectTrigger aria-label="Filter by sport">
            <SelectValue placeholder="Sport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sports</SelectItem>
            {facets.sports.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as "score" | "experience")}>
          <SelectTrigger aria-label="Sort results">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Sort by score</SelectItem>
            <SelectItem value="experience">Sort by experience</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="min-score">Minimum score: {minScore}</Label>
          <Slider
            id="min-score"
            min={MARKETPLACE_GATES.browse}
            max={100}
            step={1}
            value={[minScore]}
            onValueChange={(value) => setMinScore(value[0] ?? MARKETPLACE_GATES.browse)}
            aria-label="Minimum performance score"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="verified-only" checked={verifiedOnly} onCheckedChange={setVerifiedOnly} />
          <Label htmlFor="verified-only">Verified only</Label>
        </div>
      </div>

      {isPending && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <div className="glass rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">Coaches could not be loaded.</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isPending && !isError && coaches.length === 0 && (
        <div className="glass rounded-lg p-10 text-center">
          <Users className="mx-auto size-6 text-warm-gray" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">No coaches match these filters.</p>
        </div>
      )}

      {!isPending && !isError && coaches.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach) => (
            <CoachCard key={coach.coachId} coach={coach} />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationThread({ conversationId }: { conversationId: string }) {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(messagesQuery(conversationId));
  const sendMessageFn = useServerFn(sendMessage);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const parsed = messageSchema.safeParse({ body });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid message.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await sendMessageFn({ data: { conversationId, body: parsed.data.body } });
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["marketplace-messages", conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-conversations"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
        {isPending && <Skeleton className="h-10 w-full" />}
        {isError && <p className="text-sm text-destructive">Messages could not be loaded.</p>}
        {!isPending && !isError && (data?.messages.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet. Say hello.</p>
        )}
        {data?.messages.map((message) => (
          <div key={message.id} className="rounded-md bg-muted p-2 text-sm">
            <p className="text-foreground">{message.body}</p>
            <p className="text-data mt-1 text-xs text-warm-gray">
              {formatWhen(message.created_at)}
            </p>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="mt-3 flex items-start gap-2">
        <div className="flex-1">
          <Label htmlFor="message-body" className="sr-only">
            Message
          </Label>
          <Input
            id="message-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message"
            disabled={busy}
            aria-invalid={error !== null}
          />
          {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
        </div>
        <Button type="submit" disabled={busy} aria-label="Send message">
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </form>
    </div>
  );
}

function ConversationsSection() {
  const { data, isPending, isError } = useQuery(conversationsQuery);
  const [activeId, setActiveId] = useState<string | null>(null);
  const conversations = data?.conversations ?? [];
  const active = conversations.find((c) => c.conversationId === activeId) ?? conversations[0];

  useEffect(() => {
    if (!activeId && conversations.length > 0) {
      setActiveId(conversations[0]?.conversationId ?? null);
    }
  }, [activeId, conversations]);

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError)
    return <p className="text-sm text-destructive">Conversations could not be loaded.</p>;
  if (conversations.length === 0)
    return (
      <div className="glass rounded-lg p-10 text-center">
        <MessageSquare className="mx-auto size-6 text-warm-gray" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">
          No conversations yet. Message a coach from their profile to start one.
        </p>
      </div>
    );

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <ul className="space-y-1" aria-label="Conversations">
        {conversations.map((conversation) => (
          <li key={conversation.conversationId}>
            <button
              type="button"
              onClick={() => setActiveId(conversation.conversationId)}
              className={`w-full rounded-md p-3 text-left text-sm transition-colors ${
                active?.conversationId === conversation.conversationId
                  ? "bg-secondary text-secondary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <p className="truncate font-medium text-foreground">{conversation.counterpartName}</p>
              <p className="text-data mt-1 text-xs text-warm-gray">
                {formatWhen(conversation.lastMessageAt)}
              </p>
            </button>
          </li>
        ))}
      </ul>
      <div className="h-[28rem]">
        {active ? (
          <ConversationThread conversationId={active.conversationId} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a conversation.</p>
        )}
      </div>
    </div>
  );
}

const HIRE_STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  REQUESTED: "outline",
  ACCEPTED: "secondary",
  ACTIVE: "default",
  COMPLETED: "secondary",
  DECLINED: "destructive",
  WITHDRAWN: "destructive",
};

function EngagementsSection() {
  const queryClient = useQueryClient();
  const { data, isPending, isError } = useQuery(hiresQuery);
  const respond = useServerFn(respondToHire);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleRespond(
    hireId: string,
    status: "ACCEPTED" | "DECLINED" | "WITHDRAWN" | "ACTIVE" | "COMPLETED",
  ) {
    setBusyId(hireId);
    try {
      await respond({ data: { hireId, status } });
      await queryClient.invalidateQueries({ queryKey: ["marketplace-hires"] });
      toast.success("Engagement updated.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update engagement.");
    } finally {
      setBusyId(null);
    }
  }

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) return <p className="text-sm text-destructive">Engagements could not be loaded.</p>;

  const hires = data?.hires ?? [];
  if (hires.length === 0)
    return (
      <div className="glass rounded-lg p-10 text-center">
        <ShieldCheck className="mx-auto size-6 text-warm-gray" aria-hidden="true" />
        <p className="mt-3 text-sm text-muted-foreground">No engagements yet.</p>
      </div>
    );

  return (
    <ul className="space-y-3">
      {hires.map((hire) => {
        const busy = busyId === hire.hireId;
        const isCoach = hire.viewerRole === "coach";
        return (
          <li key={hire.hireId} className="glass rounded-lg p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{hire.counterpartName}</p>
                <p className="mt-1 text-sm text-muted-foreground">{hire.goal}</p>
                {hire.note && <p className="mt-1 text-sm text-muted-foreground">{hire.note}</p>}
                <p className="text-data mt-2 text-xs text-warm-gray">
                  Requested {formatWhen(hire.createdAt)}
                </p>
              </div>
              <Badge variant={HIRE_STATUS_VARIANT[hire.status] ?? "outline"}>{hire.status}</Badge>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {isCoach && hire.status === "REQUESTED" && (
                <>
                  <Button
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleRespond(hire.hireId, "ACCEPTED")}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void handleRespond(hire.hireId, "DECLINED")}
                  >
                    Decline
                  </Button>
                </>
              )}
              {isCoach && hire.status === "ACCEPTED" && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRespond(hire.hireId, "ACTIVE")}
                >
                  Activate
                </Button>
              )}
              {isCoach && hire.status === "ACTIVE" && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRespond(hire.hireId, "COMPLETED")}
                >
                  Complete
                </Button>
              )}
              {!isCoach && (hire.status === "REQUESTED" || hire.status === "ACCEPTED") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void handleRespond(hire.hireId, "WITHDRAWN")}
                >
                  Withdraw
                </Button>
              )}
              {!isCoach && hire.status === "ACTIVE" && (
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleRespond(hire.hireId, "COMPLETED")}
                >
                  Complete
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function MarketplaceScreen() {
  return (
    <section aria-labelledby="marketplace-title" className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 id="marketplace-title" className="font-display text-2xl font-light text-foreground">
          Marketplace
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discover coaches ranked by Performance Score. Messaging requires a score of{" "}
          {MARKETPLACE_GATES.message}+; hiring requires {MARKETPLACE_GATES.hire}+.
        </p>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="conversations">Conversations</TabsTrigger>
          <TabsTrigger value="engagements">Engagements</TabsTrigger>
        </TabsList>
        <TabsContent value="browse" className="mt-6">
          <BrowseSection />
        </TabsContent>
        <TabsContent value="conversations" className="mt-6">
          <ConversationsSection />
        </TabsContent>
        <TabsContent value="engagements" className="mt-6">
          <EngagementsSection />
        </TabsContent>
      </Tabs>
    </section>
  );
}
