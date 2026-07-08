import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Address } from "viem";

const portfolioMocks = vi.hoisted(() => ({
  fetchPortfolioBalances: vi.fn(),
  fetchExchangeBalancesSnapshot: vi.fn(),
  mergePortfolioSnapshot: vi.fn(),
  subscribeToExchangeBalances: vi.fn(),
}));

vi.mock("./balances.js", () => ({
  fetchPortfolioBalances: portfolioMocks.fetchPortfolioBalances,
}));

vi.mock("./coinbaseExchangeFeed.js", () => ({
  fetchExchangeBalancesSnapshot: portfolioMocks.fetchExchangeBalancesSnapshot,
  mergePortfolioSnapshot: portfolioMocks.mergePortfolioSnapshot,
  subscribeToExchangeBalances: portfolioMocks.subscribeToExchangeBalances,
}));

import { getPortfolioSnapshot, watchPortfolioSnapshot } from "./portfolio.js";

describe("portfolio snapshot helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("merges on-chain and exchange balances into a portfolio snapshot", async () => {
    const address = "0x1234" as Address;
    const nativeBalance = {
      chainId: 1,
      symbol: "ETH",
      balance: "1000000000000000000",
      formatted: "1",
    };
    const tokenBalance = {
      chainId: 1,
      contractAddress: "0x0000000000000000000000000000000000000001" as Address,
      symbol: "USDC",
      balance: "1000000",
      formatted: "1",
    };
    const exchangeBalance = {
      currency: "ETH",
      balance: 1,
      balanceFormatted: "1",
      source: "coinbase_exchange" as const,
    };
    const expectedSnapshot = {
      onChain: {
        native: [nativeBalance],
        tokens: [tokenBalance],
      },
      exchange: [exchangeBalance],
      updatedAt: "2024-01-01T00:00:00.000Z",
    };

    portfolioMocks.fetchPortfolioBalances.mockResolvedValue({
      native: [nativeBalance],
      tokens: [tokenBalance],
    });
    portfolioMocks.fetchExchangeBalancesSnapshot.mockResolvedValue([exchangeBalance]);
    portfolioMocks.mergePortfolioSnapshot.mockReturnValue(expectedSnapshot);

    const snapshot = await getPortfolioSnapshot(address);

    expect(portfolioMocks.fetchPortfolioBalances).toHaveBeenCalledWith(address, []);
    expect(portfolioMocks.fetchExchangeBalancesSnapshot).toHaveBeenCalledTimes(1);
    expect(portfolioMocks.mergePortfolioSnapshot).toHaveBeenCalledWith([nativeBalance], [tokenBalance], [exchangeBalance]);
    expect(snapshot).toEqual(expectedSnapshot);
  });

  it("continues polling while a watcher is active and stops it when requested", async () => {
    vi.useFakeTimers();

    const onSnapshot = vi.fn();
    portfolioMocks.fetchPortfolioBalances.mockResolvedValue({ native: [], tokens: [] });
    portfolioMocks.fetchExchangeBalancesSnapshot.mockResolvedValue([]);
    portfolioMocks.mergePortfolioSnapshot.mockReturnValue({
      onChain: { native: [], tokens: [] },
      exchange: [],
      updatedAt: "2024-01-01T00:00:00.000Z",
    });
    portfolioMocks.subscribeToExchangeBalances.mockReturnValue({
      close: vi.fn(),
      on: vi.fn(),
      send: vi.fn(),
    });

    const stop = watchPortfolioSnapshot("0x1234" as Address, onSnapshot, 30_000);

    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(onSnapshot).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(30_000);
    expect(onSnapshot).toHaveBeenCalledTimes(2);

    stop();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(onSnapshot).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
