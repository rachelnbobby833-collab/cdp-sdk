import { fetchPortfolioBalances } from "./balances.js";
import {
  fetchExchangeBalancesSnapshot,
  mergePortfolioSnapshot,
  subscribeToExchangeBalances,
  type PortfolioSnapshot,
} from "./coinbaseExchangeFeed.js";
import { tokenWatchlist } from "./tokenWatchlist.js";

import type { Address } from "viem";
/**
 * One-shot fetch of the full portfolio snapshot: on-chain balances plus
 * Coinbase Exchange balances.
 *
 * @param address - The account address whose portfolio should be fetched.
 * @returns The merged portfolio snapshot.
 */
export async function getPortfolioSnapshot(address: Address): Promise<PortfolioSnapshot> {
  const [onChain, exchange] = await Promise.all([
    fetchPortfolioBalances(address, tokenWatchlist),
    fetchExchangeBalancesSnapshot().catch(err => {
      // eslint-disable-next-line no-console
      console.warn("[portfolio] Exchange snapshot failed, continuing on-chain-only:", err);
      return [];
    }),
  ]);

  return mergePortfolioSnapshot(onChain.native, onChain.tokens, exchange);
}

/**
 * Live dashboard mode: poll on-chain balances and refresh the snapshot when
 * Coinbase Exchange emits a balance change signal.
 *
 * @param address - The account address whose portfolio should be watched.
 * @param onSnapshot - The callback invoked with each refreshed snapshot.
 * @param onChainPollMs - The interval in milliseconds between on-chain refreshes.
 * @returns A stop function that stops the watcher.
 */
export function watchPortfolioSnapshot(
  address: Address,
  onSnapshot: (snapshot: PortfolioSnapshot) => void,
  onChainPollMs = 30_000,
) {
  let stopped = false;

  const refresh = async () => {
    if (stopped) {
      return;
    }

    try {
      const snapshot = await getPortfolioSnapshot(address);
      onSnapshot(snapshot);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[portfolio] refresh failed:", err);
    }
  };

  void refresh();
  const pollHandle = setInterval(refresh, onChainPollMs);

  let ws: { close(): void } | undefined;
  try {
    ws = subscribeToExchangeBalances(
      () => void refresh(),
      err => {
        // eslint-disable-next-line no-console
        console.error("[portfolio] Coinbase WS error:", err);
      },
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[portfolio] Coinbase WS setup failed:", err);
  }

  return function stop() {
    stopped = true;
    clearInterval(pollHandle);
    ws?.close();
  };
}
