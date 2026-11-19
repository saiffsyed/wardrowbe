'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';

export interface DressingRoomSettings {
  figure: 'women' | 'men';
  background: string;
  figure_colour: string;
}

export const DEFAULT_ROOM: DressingRoomSettings = { figure: 'women', background: 'auto', figure_colour: 'auto' };

// Each person's figure and colours for the dressing room.
export function useDressingRoomSettings() {
  const { status } = useSession();
  useSetTokenIfAvailable();
  return useQuery({
    queryKey: queryKeys.dressingRoom,
    queryFn: () => api.get<DressingRoomSettings>('/dressing-room/settings'),
    enabled: status !== 'loading',
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateDressingRoomSettings() {
  const queryClient = useQueryClient();
  useSetTokenIfAvailable();
  return useMutation({
    mutationFn: (change: Partial<DressingRoomSettings>) =>
      api.patch<DressingRoomSettings>('/dressing-room/settings', change),
    onMutate: (change) => {
      const before = queryClient.getQueryData<DressingRoomSettings>(queryKeys.dressingRoom);
      queryClient.setQueryData(queryKeys.dressingRoom, { ...DEFAULT_ROOM, ...before, ...change });
      return { before };
    },
    onError: (_error, _change, context) => queryClient.setQueryData(queryKeys.dressingRoom, context?.before),
    onSuccess: (saved) => queryClient.setQueryData(queryKeys.dressingRoom, saved),
  });
}
