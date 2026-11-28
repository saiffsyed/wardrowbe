'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';
import type { LaundryMove } from '@/lib/laundry';
import type { Item } from '@/lib/types';

// Clothes away being cleaned. "Needs washing" is the item's own needs_wash flag.
// The stored half of the laundry state; lib/laundry.ts turns it into the item's one state.
export type LaundryState = 'wash' | 'dry';
export type { LaundryMove };

export interface LaundryLists {
  to_wash: Item[];
  wash: Item[];
  dry: Item[];
}

function useReady() {
  const { status } = useSession();
  useSetTokenIfAvailable();
  return status !== 'loading';
}

// The three lists of the Laundry screen, for the clothes kept in one home.
export function useLaundry(homeId: string | undefined) {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.laundry(homeId ?? ''),
    queryFn: () => api.get<LaundryLists>('/laundry', { params: homeId ? { home_id: homeId } : undefined }),
    enabled: ready,
  });
}

// Which clothes are away, by item id, for badges and for leaving them out of outfits.
export function useLaundryStates() {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.laundryStates,
    queryFn: async () => {
      const rows = await api.get<{ item_id: string; state: LaundryState }[]>('/laundry/states');
      return new Map(rows.map((row) => [row.item_id, row.state]));
    },
    enabled: ready,
    staleTime: 60 * 1000,
  });
}

export function useMoveLaundry() {
  const queryClient = useQueryClient();
  useSetTokenIfAvailable();
  return useMutation({
    mutationFn: ({ itemIds, to }: { itemIds: string[]; to: LaundryMove }) =>
      api.post<{ moved: number }>('/laundry/move', { item_ids: itemIds, to }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.everyLaundry });
      queryClient.invalidateQueries({ queryKey: queryKeys.laundryStates });
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.everyItem });
    },
  });
}
