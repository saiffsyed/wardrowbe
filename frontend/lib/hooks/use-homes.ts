'use client';

import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable, applySessionToken } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';
import type { BulkBatchResponse } from '@/lib/bulk-batches';
import { drainBulkAction, type BulkOperationParams } from '@/lib/hooks/use-items';
import type { Home, Item, MaterialShare, WardrobeFacets } from '@/lib/types';

export interface HomeInput {
  name: string;
  city: string;
}

// The label and receipt details a person fills in by hand. null clears a detail and a key that
// is left out is untouched, the same convention the tag editor's change sets use.
export interface ClosetDetailEdits {
  home_id?: string | null;
  brand?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  tags?: {
    size?: string | null;
    size_system?: string | null;
    fit_note?: string | null;
    purchase_place?: string | null;
    care_instructions?: string | null;
    composition?: MaterialShare[] | null;
    occasions?: string[] | null;
    currency?: string | null;
  };
}

// Which home an item is in changes the per-home counts and what the filters can offer, and
// switching home changes the city the weather is read for.
function invalidateHomeViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.homes });
  queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeFacets.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeCategories.all });
  queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
}

export function useHomes() {
  const { status } = useSession();
  useSetTokenIfAvailable();

  return useQuery({
    queryKey: queryKeys.homes,
    queryFn: () => api.get<Home[]>('/homes'),
    enabled: status !== 'loading',
  });
}

export function useWardrobeFacets(homeId?: string) {
  const { status } = useSession();
  useSetTokenIfAvailable();

  return useQuery({
    queryKey: queryKeys.wardrobeFacets.home(homeId),
    queryFn: () =>
      api.get<WardrobeFacets>('/wardrobe/facets', homeId ? { params: { home_id: homeId } } : undefined),
    enabled: status !== 'loading',
  });
}

export function useCreateHome() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (home: HomeInput) => {
      applySessionToken(session);
      return api.post<Home>('/homes', home);
    },
    onSuccess: () => {
      invalidateHomeViews(queryClient);
      // The first home also becomes the weather location.
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather });
    },
  });
}

export function useUpdateHome() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ id, home }: { id: string; home: Partial<HomeInput> }) => {
      applySessionToken(session);
      return api.patch<Home>(`/homes/${id}`, home);
    },
    onSuccess: () => {
      invalidateHomeViews(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather });
    },
  });
}

export function useDeleteHome() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      applySessionToken(session);
      return api.delete<void>(`/homes/${id}`);
    },
    onSuccess: () => invalidateHomeViews(queryClient),
  });
}

export function useSetCurrentHome() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (id: string) => {
      applySessionToken(session);
      return api.post<Home>(`/homes/${id}/current`);
    },
    onSuccess: () => {
      invalidateHomeViews(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.userProfile });
      queryClient.invalidateQueries({ queryKey: queryKeys.weather });
    },
  });
}

export function useMoveItemsToHome() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ homeId, itemIds }: { homeId: string; itemIds: string[] }) => {
      applySessionToken(session);
      return api.post<{ moved: number }>(`/homes/${homeId}/items`, { item_ids: itemIds });
    },
    onSuccess: () => {
      invalidateHomeViews(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.everyItem });
    },
  });
}

export function useUpdateClosetDetails() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ id, edits }: { id: string; edits: ClosetDetailEdits }) => {
      applySessionToken(session);
      return api.patch<Item>(`/items/${id}`, edits);
    },
    onSuccess: (item) => {
      queryClient.setQueryData(queryKeys.item(item.id), item);
      invalidateHomeViews(queryClient);
    },
  });
}

/** Moves the wardrobe's multi-selection into one home, in batches for a large "select all". */
export function useMoveSelectionToHome() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async ({ homeId, selection }: { homeId: string; selection: BulkOperationParams }) => {
      applySessionToken(session);
      return drainBulkAction<BulkBatchResponse & { moved: number }>(
        `/homes/${homeId}/items/bulk`,
        selection,
        ['moved']
      );
    },
    onSuccess: () => {
      invalidateHomeViews(queryClient);
      queryClient.invalidateQueries({ queryKey: queryKeys.everyItem });
    },
  });
}
