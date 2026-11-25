'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';
import type { Outfit } from '@/lib/types';

export interface PartnerInfo {
  id: string;
  display_name: string;
  avatar_url?: string | null;
}

export interface Couple {
  partner: PartnerInfo | null;
  partner_shares: boolean;
  share_plans: boolean;
  choices: PartnerInfo[];
}

function useReady() {
  const { status } = useSession();
  useSetTokenIfAvailable();
  return status !== 'loading';
}

// Your partner (a family member) and both of your sharing switches.
export function useCouple() {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.couple,
    queryFn: () => api.get<Couple>('/couple'),
    enabled: ready,
    staleTime: 5 * 60 * 1000,
  });
}

// Your partner's looks planned between two days (empty when they do not share).
export function usePartnerPlans(from: string, to: string, enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.partnerPlans(from, to),
    queryFn: () => api.get<Outfit[]>('/couple/plans', { params: { date_from: from, date_to: to } }),
    enabled: ready && enabled,
    staleTime: 60 * 1000,
  });
}

export function useUpdateCouple() {
  const queryClient = useQueryClient();
  useSetTokenIfAvailable();
  return useMutation({
    mutationFn: (change: { share_plans?: boolean; partner_id?: string }) => api.patch<Couple>('/couple', change),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.couple, saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.everyPartnerPlans });
    },
  });
}
