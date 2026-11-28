'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';
import type { BoardPiece } from '@/lib/board-layout';

export interface OutfitLayout {
  outfit_id: string;
  background: string;
  pieces: BoardPiece[];
}

// The saved arrangements of these outfits, by outfit id. Outfits never arranged by hand are
// missing from the map and are shown with the automatic layout.
export function useOutfitLayouts(outfitIds: string[]) {
  const { status } = useSession();
  useSetTokenIfAvailable();
  const ids = Array.from(new Set(outfitIds)).sort();
  return useQuery({
    queryKey: queryKeys.outfitLayouts(ids.join(',')),
    queryFn: async () => {
      const layouts = await api.get<OutfitLayout[]>('/outfit-layouts', { params: { ids: ids.join(',') } });
      return new Map(layouts.map((layout) => [layout.outfit_id, layout]));
    },
    enabled: status !== 'loading' && ids.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveOutfitLayout() {
  const queryClient = useQueryClient();
  useSetTokenIfAvailable();
  return useMutation({
    mutationFn: ({ outfitId, background, pieces }: { outfitId: string; background: string; pieces: BoardPiece[] }) =>
      api.put<OutfitLayout>(`/outfit-layouts/${outfitId}`, { background, pieces }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.everyOutfitLayout }),
  });
}
