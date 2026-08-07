/**
 * Client-safe marketplace filter contract shared by the search UI and the
 * server-side coach search (marketplace.server.ts).
 */
export interface MarketplaceFilters {
  query?: string | undefined;
  specialization?: string | undefined;
  sport?: string | undefined;
  minScore?: number | undefined;
  verifiedOnly?: boolean | undefined;
  sort?: "score" | "experience" | undefined;
}
