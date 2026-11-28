'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { applySessionToken } from '@/lib/hooks/use-session-token';
import type { Item } from '@/lib/types';

// "Find the exact product" (our fork): a search changes nothing; using a match replaces the main
// photo (the own photo is kept as an extra one) and saves only the ticked details.
export interface ProductMatch {
  page_url: string;
  image_url: string;
  thumb: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  colour: string | null;
  article_match: boolean;
}

export type FindStatus = 'found' | 'nothing' | 'no_brand' | 'ai_disabled' | 'over_limit' | 'unreachable';

export interface FindProductResult {
  status: FindStatus;
  matches: ProductMatch[];
  spent_cents: number;
  limit_cents: number;
}

export interface UseProductBody {
  page_url: string;
  image_url: string;
  name?: string;
  colour?: string;
  price?: number;
  currency?: string;
}

export function useFindProduct() {
  const { data: session } = useSession();
  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async (itemId: string) => {
      applySessionToken(session);
      return api.post<FindProductResult>(`/items/${itemId}/find-product`);
    },
  });
}

export function useUseProduct() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async ({ itemId, body }: { itemId: string; body: UseProductBody }) => {
      applySessionToken(session);
      return api.post<Item>(`/items/${itemId}/use-product`, body);
    },
    onSuccess: (item) => {
      queryClient.setQueryData(queryKeys.item(item.id), item);
      // The photo changed everywhere the item is shown.
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeFacets.all });
    },
  });
}
