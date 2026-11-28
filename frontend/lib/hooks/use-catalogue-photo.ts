'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { applySessionToken } from '@/lib/hooks/use-session-token';
import type { Item } from '@/lib/types';

// Catalogue photo (our fork): making one costs money and changes nothing; it stays a draft until
// used, which makes it the main photo and keeps the own photo as an extra one.
export interface CatalogueDraft {
  status: 'ready' | 'ai_disabled' | 'over_limit' | 'failed';
  draft_id: string | null;
  preview: string | null;
  spent_cents: number;
  limit_cents: number;
}

export function useMakeCataloguePhoto() {
  const { data: session } = useSession();
  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async (itemId: string) => {
      applySessionToken(session);
      return api.post<CatalogueDraft>(`/items/${itemId}/catalogue-photo`);
    },
  });
}

export function useUseCataloguePhoto() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async ({ itemId, draftId }: { itemId: string; draftId: string }) => {
      applySessionToken(session);
      return api.post<Item>(`/items/${itemId}/catalogue-photo/${draftId}/use`);
    },
    onSuccess: (item) => {
      queryClient.setQueryData(queryKeys.item(item.id), item);
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}

export function useDropCataloguePhoto() {
  const { data: session } = useSession();
  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async ({ itemId, draftId }: { itemId: string; draftId: string }) => {
      applySessionToken(session);
      return api.delete<void>(`/items/${itemId}/catalogue-photo/${draftId}`);
    },
  });
}
