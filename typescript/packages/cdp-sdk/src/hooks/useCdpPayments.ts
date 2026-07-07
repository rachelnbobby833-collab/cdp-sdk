import { useCallback, useEffect, useRef, useState } from "react";

export interface AccountBalance {
  asset: string;
  amount: string;
}

export interface DepositDestination {
  id: string;
  address: string;
  network: string;
  asset: string;
  accountId: string;
  createdAt: string;
}

export type FetchStatus = "idle" | "loading" | "success" | "error";

export type UseCdpPaymentsCreateStatus = "idle" | "pending" | "success" | "error";

export type UseCdpPaymentsCreateState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; destination: DepositDestination }
  | { status: "error"; error: string };

export interface UseCdpPaymentsCreateDestinationInput {
  address: string;
  network: string;
  asset: string;
  accountId?: string;
}

const API_BASE = "/api/cdp";

function normalizeAccountId(accountId: string | undefined) {
  if (typeof accountId !== "string") {
    return undefined;
  }

  const trimmedAccountId = accountId.trim();
  return trimmedAccountId ? trimmedAccountId : undefined;
}

function buildApiUrl(path: string, accountId: string | undefined) {
  const normalizedAccountId = normalizeAccountId(accountId);
  const query = normalizedAccountId
    ? `?accountId=${encodeURIComponent(normalizedAccountId)}`
    : "";
  return `${API_BASE}${path}${query}`;
}

function getHttpErrorMessage(prefix: string, response: Response) {
  return `${prefix}: ${response.status} ${response.statusText}`.trim();
}

async function readResponseBody<T>(response: Response): Promise<T> {
  const bodyText = await response.text();

  if (!bodyText) {
    throw new Error("The server returned an empty response body.");
  }

  try {
    return JSON.parse(bodyText) as T;
  } catch {
    throw new Error("The server returned an invalid JSON response body.");
  }
}

export function useCdpPayments(accountId: string | undefined) {
  const normalizedAccountId = normalizeAccountId(accountId);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [balancesStatus, setBalancesStatus] = useState<FetchStatus>("idle");
  const [destinations, setDestinations] = useState<DepositDestination[]>([]);
  const [destinationsStatus, setDestinationsStatus] = useState<FetchStatus>("idle");
  const [createState, setCreateState] = useState<UseCdpPaymentsCreateState>({
    status: "idle",
  });
  const requestControllersRef = useRef<{
    balances?: AbortController;
    destinations?: AbortController;
    create?: AbortController;
  }>({});

  const fetchBalances = useCallback(async () => {
    if (!normalizedAccountId) {
      setBalances([]);
      setBalancesStatus("idle");
      return;
    }

    const controller = new AbortController();
    requestControllersRef.current.balances?.abort();
    requestControllersRef.current.balances = controller;
    setBalancesStatus("loading");

    try {
      const response = await fetch(buildApiUrl("/balances", normalizedAccountId), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(getHttpErrorMessage("Unable to load balances", response));
      }

      const payload = await readResponseBody<AccountBalance[]>(response);
      if (!controller.signal.aborted) {
        setBalances(Array.isArray(payload) ? payload : []);
        setBalancesStatus("success");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Failed to load balances", error);
        setBalances([]);
        setBalancesStatus("error");
      }
    }
  }, [normalizedAccountId]);

  const fetchDestinations = useCallback(async () => {
    if (!normalizedAccountId) {
      setDestinations([]);
      setDestinationsStatus("idle");
      return;
    }

    const controller = new AbortController();
    requestControllersRef.current.destinations?.abort();
    requestControllersRef.current.destinations = controller;
    setDestinationsStatus("loading");

    try {
      const response = await fetch(buildApiUrl("/destinations", normalizedAccountId), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(getHttpErrorMessage("Unable to load deposit destinations", response));
      }

      const payload = await readResponseBody<DepositDestination[]>(response);
      if (!controller.signal.aborted) {
        setDestinations(Array.isArray(payload) ? payload : []);
        setDestinationsStatus("success");
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Failed to load deposit destinations", error);
        setDestinations([]);
        setDestinationsStatus("error");
      }
    }
  }, [normalizedAccountId]);

  const createDestination = useCallback(
    async (input?: UseCdpPaymentsCreateDestinationInput) => {
      const resolvedAccountId = normalizeAccountId(input?.accountId ?? accountId);

      if (!resolvedAccountId) {
        const message = "An accountId is required to create a deposit destination.";
        setCreateState({ status: "error", error: message });
        throw new Error(message);
      }

      const hasRequiredFields =
        typeof input?.address === "string" &&
        input.address.trim().length > 0 &&
        typeof input?.network === "string" &&
        input.network.trim().length > 0 &&
        typeof input?.asset === "string" &&
        input.asset.trim().length > 0;

      if (!hasRequiredFields) {
        const message = "address, network, and asset are required to create a deposit destination.";
        setCreateState({ status: "error", error: message });
        throw new Error(message);
      }

      const controller = new AbortController();
      requestControllersRef.current.create?.abort();
      requestControllersRef.current.create = controller;
      setCreateState({ status: "pending" });

      try {
        const response = await fetch(buildApiUrl("/destinations", resolvedAccountId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            accountId: resolvedAccountId,
            address: input.address.trim(),
            network: input.network.trim(),
            asset: input.asset.trim(),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(getHttpErrorMessage("Unable to create deposit destination", response));
        }

        const destination = await readResponseBody<DepositDestination>(response);
        setCreateState({ status: "success", destination });
        setDestinations((currentDestinations) => [destination, ...currentDestinations]);
        return destination;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while creating the deposit destination.";
        setCreateState({ status: "error", error: message });
        throw error;
      }
    },
    [accountId],
  );

  const resetCreate = useCallback(() => {
    setCreateState({ status: "idle" });
  }, []);

  useEffect(() => {
    void fetchBalances();
  }, [fetchBalances]);

  useEffect(() => {
    void fetchDestinations();
  }, [fetchDestinations]);

  useEffect(() => {
    return () => {
      requestControllersRef.current.balances?.abort();
      requestControllersRef.current.destinations?.abort();
      requestControllersRef.current.create?.abort();
    };
  }, []);

  return {
    balances,
    balancesStatus,
    refetchBalances: fetchBalances,
    destinations,
    destinationsStatus,
    refetchDestinations: fetchDestinations,
    createDestination,
    createStatus: createState.status,
    createError: createState.status === "error" ? createState.error : undefined,
    resetCreate,
  };
}
