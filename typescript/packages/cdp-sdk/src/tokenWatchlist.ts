import type { Address } from "viem";

/**
 * Default token watchlist used by the portfolio snapshot helpers.
 * Keeping it empty by default preserves the behavior of a no-op watchlist
 * so callers can opt into their own list without changing the API surface.
 */
export const tokenWatchlist: readonly Address[] = [];
