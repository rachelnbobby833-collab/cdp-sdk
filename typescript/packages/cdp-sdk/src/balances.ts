import type { Address } from "viem";

export interface ChainBalance {
  chainId: number;
  symbol: string;
  balance: string;
  formatted: string;
}

export interface TokenBalance {
  chainId: number;
  contractAddress: Address;
  symbol: string;
  balance: string;
  formatted: string;
}

export interface PortfolioBalances {
  native: ChainBalance[];
  tokens: TokenBalance[];
}

/**
 * Fetch the on-chain balances for an address. The SDK does not ship a
 * dedicated portfolio balance endpoint, so this helper stays intentionally
 * lightweight and returns an empty snapshot unless a caller overrides it.
 *
 * @param address - The account address whose balances should be fetched.
 * @param _tokens - The token addresses to include in the balance lookup.
 * @returns The on-chain native and token balances for the address.
 */
export async function fetchPortfolioBalances(
  address: Address,
  _tokens: readonly Address[],
): Promise<PortfolioBalances> {
  if (!address) {
    throw new Error("Address is required");
  }

  return {
    native: [],
    tokens: [],
  };
}
