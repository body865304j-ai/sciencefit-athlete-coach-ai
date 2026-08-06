import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bell, Check, Search } from "lucide-react";
import { notificationsQuery } from "@/lib/queries";
import { markNotificationsRead } from "@/lib/app.functions";
import { NOTIFICATION_CATEGORIES } from "@/lib/business";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ReadFilter = "all" | "unread" | "read";

function formatWhen(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NotificationsScreen() {
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery(notificationsQuery);
  const markRead = useServerFn(markNotificationsRead);

  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  const notifications = useMemo(() => data?.notifications ?? [], [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return notifications.filter((item) => {
      if (readFilter === "unread" && item.read_at !== null) return false;
      if (readFilter === "read" && item.read_at === null) return false;
      if (category !== "all" && item.category !== category) return false;
      if (
        term &&
        !`${item.title} ${item.body}`.toLowerCase().includes(term)
      )
        return false;
      return true;
    });
  }, [notifications, readFilter, category, search]);

  async function mark(ids: string[] | "all") {
    setBusy(true);
    try {
      await markRead({ data: { ids } });
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not update notifications.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="notifications-title" className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            id="notifications-title"
            className="font-display text-2xl font-light text-foreground"
          >
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" aria-live="polite">
            {data ? `${data.unread} unread of ${notifications.length}` : "Loading"}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void mark("all")}
          disabled={busy || (data?.unread ?? 0) === 0}
        >
          <Check className="size-4" aria-hidden="true" />
          Mark all read
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-warm-gray"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search notifications"
            placeholder="Search notifications"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          value={readFilter}
          onValueChange={(value) => setReadFilter(value as ReadFilter)}
        >
          <SelectTrigger aria-label="Filter by read state" className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger aria-label="Filter by category" className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {NOTIFICATION_CATEGORIES.map((item) => (
              <SelectItem key={item} value={item}>
                {item.replaceAll("_", " ").toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isPending && (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {isError && (
        <div className="glass mt-6 rounded-lg p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Notifications could not be loaded.
          </p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}

      {!isPending && !isError && filtered.length === 0 && (
        <div className="glass mt-6 rounded-lg p-10 text-center">
          <Bell className="mx-auto size-6 text-warm-gray" aria-hidden="true" />
          <p className="mt-3 text-sm text-muted-foreground">
            No notifications match these filters.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-3">
        {filtered.map((item) => (
          <li
            key={item.id}
            className={`glass rounded-lg p-5 ${
              item.read_at === null ? "border-l-2 border-l-primary" : ""
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-data text-[0.65rem] uppercase tracking-[0.2em] text-primary">
                  {item.category.replaceAll("_", " ")}
                </p>
                <h2 className="mt-2 text-sm font-medium text-foreground">
                  {item.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                <p className="text-data mt-2 text-xs text-warm-gray">
                  {formatWhen(item.created_at)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.read_at === null ? (
                  <Badge variant="secondary">Unread</Badge>
                ) : (
                  <span className="text-xs text-warm-gray">Read</span>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {item.link_path && (
                <Button asChild variant="outline" size="sm">
                  <Link to={item.link_path}>Open</Link>
                </Button>
              )}
              {item.read_at === null && (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => void mark([item.id])}
                >
                  Mark read
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
