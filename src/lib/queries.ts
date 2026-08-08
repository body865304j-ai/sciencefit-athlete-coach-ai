import { queryOptions } from "@tanstack/react-query";
import { getViewer } from "@/lib/flow.functions";
import {
  getAccount,
  getAthleteDashboard,
  getCoachDashboard,
  getLeaderboard,
  getMarketplace,
  getNotifications,
} from "@/lib/app.functions";
import {
  getConversations,
  getHires,
  getMessages,
  getMyProfile,
  getPublicCoachProfile,
  searchCoaches,
} from "@/lib/profile.functions";
import type { MarketplaceFilters } from "@/lib/marketplace-filters";

export type CoachSearchFilters = MarketplaceFilters;

/** Shared query definitions so every screen reads from one cache entry. */

export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => getViewer(),
  staleTime: 30_000,
});

export const athleteDashboardQuery = queryOptions({
  queryKey: ["athlete-dashboard"],
  queryFn: () => getAthleteDashboard(),
});

export const coachDashboardQuery = queryOptions({
  queryKey: ["coach-dashboard"],
  queryFn: () => getCoachDashboard(),
});

export const leaderboardQuery = queryOptions({
  queryKey: ["leaderboard"],
  queryFn: () => getLeaderboard(),
});

export const marketplaceQuery = queryOptions({
  queryKey: ["marketplace"],
  queryFn: () => getMarketplace(),
});

export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => getNotifications(),
  refetchInterval: 60_000,
});

export const accountQuery = queryOptions({
  queryKey: ["account"],
  queryFn: () => getAccount(),
});

export const myProfileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: () => getMyProfile(),
});

export const coachSearchQuery = (filters: CoachSearchFilters) =>
  queryOptions({
    queryKey: ["coach-search", filters],
    queryFn: () => searchCoaches({ data: filters }),
  });

export const publicCoachQuery = (coachId: string) =>
  queryOptions({
    queryKey: ["public-coach", coachId],
    queryFn: () => getPublicCoachProfile({ data: { coachId } }),
  });

export const conversationsQuery = queryOptions({
  queryKey: ["marketplace-conversations"],
  queryFn: () => getConversations(),
});

export const messagesQuery = (conversationId: string) =>
  queryOptions({
    queryKey: ["marketplace-messages", conversationId],
    queryFn: () => getMessages({ data: { conversationId } }),
    refetchInterval: 20_000,
  });

export const hiresQuery = queryOptions({
  queryKey: ["marketplace-hires"],
  queryFn: () => getHires(),
});
