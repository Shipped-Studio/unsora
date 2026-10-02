import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/nextjs";
import { useAuthFetch } from "@/hooks/use-auth-fetch";

export type CreditTransactionType =
  | "GRANT"
  | "CONSUMPTION"
  | "REFUND"
  | "EXPIRY"
  | "ADJUSTMENT";

export interface CreditTransaction {
  id: string;
  type: CreditTransactionType;
  /** Signed: grants and refunds are positive, usage and expiry negative. */
  amount: number;
  label: string;
  source: "web" | "api";
  apiKeyName: string | null;
  createdAt: string;
}

export interface CreditTransactionsPage {
  transactions: CreditTransaction[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const creditTransactionsQueryKeys = {
  all: ["credit-transactions"] as const,
  page: (page: number, limit: number) =>
    [...creditTransactionsQueryKeys.all, page, limit] as const,
};

export function useCreditTransactions(page: number, limit = 20) {
  const { authFetch } = useAuthFetch();
  const { isSignedIn } = useUser();

  return useQuery({
    queryKey: creditTransactionsQueryKeys.page(page, limit),
    queryFn: async (): Promise<CreditTransactionsPage> => {
      const res = await authFetch(
        `/api/user/credit-transactions?page=${page}&limit=${limit}`,
      );
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || "Couldn't load credit history.");
      }
      return data.data as CreditTransactionsPage;
    },
    enabled: !!isSignedIn,
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}
