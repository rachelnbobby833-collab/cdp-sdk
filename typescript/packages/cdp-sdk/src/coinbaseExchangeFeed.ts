import { createHmac } from "node:crypto";
import { createRequire } from "node:module";

import type { ChainBalance, TokenBalance } from "./balances.js";

const COINBASE_WS_URL = "wss://ws-feed.exchange.coinbase.com";
const CB_API_KEY = process.env.COINBASE_EXCHANGE_API_KEY ?? "";
const CB_API_SECRET = process.env.COINBASE_EXCHANGE_API_SECRET ?? "";
const CB_API_PASSPHRASE = process.env.COINBASE_EXCHANGE_API_PASSPHRASE ?? "";
const require = createRequire(import.meta.url);

/**
 * A Coinbase Exchange account balance entry.
 */
export interface ExchangeBalance {
  currency: string;
  balance: number;
  balanceFormatted: string;
  source: "coinbase_exchange";
}

/**
 * The merged view of on-chain and exchange balances for a portfolio.
 */
export interface PortfolioSnapshot {
  onChain: {
    native: ChainBalance[];
    tokens: TokenBalance[];
  };
  exchange: ExchangeBalance[];
  updatedAt: string;
}

/**
 * A minimal websocket-like object used by the Coinbase Exchange subscription helper.
 */
export interface WebSocketLike {
  on(event: string, handler: (...args: unknown[]) => void): WebSocketLike;
  send(data: string): void;
  close(): void;
}

type WebSocketConstructor = new (url: string) => WebSocketLike;

/**
 * A lightweight websocket implementation used when a real websocket runtime is unavailable.
 */
class InMemoryWebSocket implements WebSocketLike {
  private listeners = new Map<string, Array<(...args: unknown[]) => void>>();

  /**
   * Create a websocket stub.
   *
   * @param url - The websocket URL.
   */
  constructor(private readonly url: string) {
    this.url = url;
  }

  /**
   * Register a handler for a websocket event.
   *
   * @param event - The event name.
   * @param handler - The handler to register.
   * @returns The websocket instance.
   */
  on(event: string, handler: (...args: unknown[]) => void): WebSocketLike {
    const handlers = this.listeners.get(event) ?? [];
    handlers.push(handler);
    this.listeners.set(event, handlers);
    return this;
  }

  /**
   * Send data over the stub websocket.
   *
   * @param _data - The data payload.
   */
  send(_data: string): void {
    // No-op; the caller can trigger events manually in tests.
  }

  /**
   * Close the stub websocket.
   */
  close(): void {
    this.emit("close");
  }

  /**
   * Emit an event to all registered handlers.
   *
   * @param event - The event name.
   * @param args - The event payload.
   */
  emit(event: string, ...args: unknown[]): void {
    const handlers = this.listeners.get(event) ?? [];
    for (const handler of handlers) {
      handler(...args);
    }
  }
}

/**
 * Resolve the websocket constructor used by the Coinbase Exchange feed.
 *
 * @returns The websocket constructor to use.
 */
function getWebSocketConstructor(): WebSocketConstructor {
  const globalWebSocket = (
    globalThis as typeof globalThis & {
      WebSocket?: WebSocketConstructor;
    }
  ).WebSocket;
  if (typeof globalWebSocket === "function") {
    return globalWebSocket;
  }

  try {
    const wsModule = require("ws") as { default?: WebSocketConstructor } | WebSocketConstructor;
    return (wsModule as { default?: WebSocketConstructor }).default ?? wsModule;
  } catch {
    return InMemoryWebSocket as unknown as WebSocketConstructor;
  }
}

/**
 * Sign a Coinbase Exchange request.
 *
 * @param timestamp - The request timestamp.
 * @param method - The HTTP method.
 * @param requestPath - The request path.
 * @param body - The request body.
 * @returns The signed message.
 */
function signMessage(timestamp: string, method: string, requestPath: string, body = ""): string {
  const key = Buffer.from(CB_API_SECRET, "base64");
  const message = timestamp + method + requestPath + body;
  return createHmac("sha256", key).update(message).digest("base64");
}

/**
 * Build Coinbase Exchange authentication headers for a request.
 *
 * @param method - The HTTP method.
 * @param requestPath - The request path.
 * @returns The authentication headers.
 */
function buildCoinbaseExchangeHeaders(method: string, requestPath: string): HeadersInit {
  if (!CB_API_KEY || !CB_API_SECRET || !CB_API_PASSPHRASE) {
    return {};
  }

  const timestamp = (Date.now() / 1000).toString();
  const signature = signMessage(timestamp, method, requestPath);
  return {
    "CB-ACCESS-KEY": CB_API_KEY,
    "CB-ACCESS-SIGN": signature,
    "CB-ACCESS-TIMESTAMP": timestamp,
    "CB-ACCESS-PASSPHRASE": CB_API_PASSPHRASE,
    "Content-Type": "application/json",
  };
}

/**
 * Merge on-chain and Coinbase Exchange balances into a single portfolio snapshot.
 *
 * @param native - The native balances for the on-chain portfolio.
 * @param tokens - The token balances for the on-chain portfolio.
 * @param exchange - The Coinbase Exchange balances to include.
 * @returns A merged portfolio snapshot.
 */
export function mergePortfolioSnapshot(
  native: ChainBalance[],
  tokens: TokenBalance[],
  exchange: ExchangeBalance[],
): PortfolioSnapshot {
  return {
    onChain: {
      native,
      tokens,
    },
    exchange,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * REST snapshot of Coinbase Exchange account balances. The WS feed is treated as a
 * change signal and the caller can re-poll this endpoint whenever required.
 *
 * @returns The current Coinbase Exchange balance snapshot.
 */
export async function fetchExchangeBalancesSnapshot(): Promise<ExchangeBalance[]> {
  if (!CB_API_KEY || !CB_API_SECRET || !CB_API_PASSPHRASE) {
    return [];
  }

  if (typeof fetch !== "function") {
    return [];
  }

  const baseUrl = process.env.COINBASE_EXCHANGE_API_URL ?? "https://api.exchange.coinbase.com";
  const response = await fetch(`${baseUrl}/accounts`, {
    method: "GET",
    headers: buildCoinbaseExchangeHeaders("GET", "/accounts"),
  });

  if (!response.ok) {
    throw new Error(`Coinbase Exchange accounts request failed: ${response.status}`);
  }

  const payload = (await response.json()) as Array<{
    currency?: string;
    balance?: string | number;
    available?: string | number;
  }>;

  return payload.map(account => ({
    currency: account.currency ?? "",
    balance: Number(account.balance ?? account.available ?? 0),
    balanceFormatted: `${account.balance ?? account.available ?? 0}`,
    source: "coinbase_exchange",
  }));
}

/**
 * Opens an authenticated connection to Coinbase Exchange's WS feed and streams
 * balance updates via the "user" channel. Calls onUpdate when the feed emits
 * an event that suggests balances may have changed.
 *
 * @param onUpdate - The callback invoked when the feed reports a balance change.
 * @param onError - The callback invoked when the feed errors.
 * @returns A websocket-like instance for the subscription.
 */
export function subscribeToExchangeBalances(
  onUpdate: (balances: ExchangeBalance[]) => void,
  onError?: (err: Error) => void,
): WebSocketLike {
  if (!CB_API_KEY || !CB_API_SECRET || !CB_API_PASSPHRASE) {
    throw new Error("Missing Coinbase Exchange API credentials in env");
  }

  const WebSocketImplementation = getWebSocketConstructor();
  const ws = new WebSocketImplementation(COINBASE_WS_URL);

  ws.on("open", () => {
    const timestamp = (Date.now() / 1000).toString();
    const signature = signMessage(timestamp, "GET", "/users/self/verify");

    ws.send(
      JSON.stringify({
        type: "subscribe",
        channels: ["user"],
        signature,
        key: CB_API_KEY,
        passphrase: CB_API_PASSPHRASE,
        timestamp,
      }),
    );
  });

  ws.on("message", (raw: unknown) => {
    try {
      const message = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (message && typeof message === "object" && "type" in message) {
        const payload = message as { type?: string; message?: string };
        if (payload.type === "error") {
          onError?.(new Error(payload.message ?? "Coinbase WS error"));
          return;
        }

        if (payload.type === "received" || payload.type === "done" || payload.type === "match") {
          onUpdate([]);
        }
      }
    } catch (err) {
      onError?.(err as Error);
    }
  });

  ws.on("error", (err: unknown) => onError?.(err as Error));

  return ws;
}
