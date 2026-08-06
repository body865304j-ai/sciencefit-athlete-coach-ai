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
