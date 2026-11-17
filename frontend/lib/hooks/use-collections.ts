'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';

export interface CollectionSummary {
  id: string;
  name: string;
  entry_count: number;
  // Up to four pictures for the card's collage.
  cover_urls: string[];
}

export interface CollectionEntry {
  id: string;
  kind: 'item' | 'outfit';
  item?: { id: string; name: string | null; type: string; thumbnail_url: string | null } | null;
  outfit?: {
    id: string;
    name: string | null;
    occasion: string;
    scheduled_for: string | null;
    thumbnail_urls: string[];
    pieces?: { type: string; thumbnail_url: string }[];
  } | null;
}

export interface CollectionDetail {
  id: string;
  name: string;
  entries: CollectionEntry[];
}

// What can be put in a collection: clothes, outfits or both at once.
export interface CollectionAdditions {
  item_ids?: string[];
  outfit_ids?: string[];
}

export interface Holder {
  itemId?: string;
  outfitId?: string;
}

function useReady() {
  const { status } = useSession();
  useSetTokenIfAvailable();
  return status !== 'loading';
}

export function useCollections(holder: Holder = {}, enabled = true) {
  const ready = useReady();
  const params: Record<string, string> = {};
  if (holder.itemId) params.item_id = holder.itemId;
  if (holder.outfitId) params.outfit_id = holder.outfitId;
  return useQuery({
    queryKey: queryKeys.collections.list(holder.itemId, holder.outfitId),
    queryFn: () => api.get<CollectionSummary[]>('/collections', { params }),
    enabled: ready && enabled,
  });
}

export function useCollection(collectionId: string | undefined) {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.collection(collectionId ?? ''),
    queryFn: () => api.get<CollectionDetail>(`/collections/${collectionId}`),
    enabled: ready && !!collectionId,
  });
}

function useInvalidateCollections() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.everyCollection });
  };
}

export function useCreateCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (name: string) => api.post<CollectionSummary>('/collections', { name }),
    onSuccess: invalidate,
  });
}

export function useRenameCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<CollectionSummary>(`/collections/${id}`, { name }),
    onSuccess: invalidate,
  });
}

export function useDeleteCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/collections/${id}`),
    onSuccess: invalidate,
  });
}

export function useAddToCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: ({ id, additions }: { id: string; additions: CollectionAdditions }) =>
      api.post<{ added: number; skipped: number }>(`/collections/${id}/entries`, {
        item_ids: additions.item_ids ?? [],
        outfit_ids: additions.outfit_ids ?? [],
      }),
    onSuccess: invalidate,
  });
}

export function useRemoveFromCollection() {
  const invalidate = useInvalidateCollections();
  return useMutation({
    mutationFn: ({ id, entryId }: { id: string; entryId: string }) =>
      api.delete<void>(`/collections/${id}/entries/${entryId}`),
    onSuccess: invalidate,
  });
}
