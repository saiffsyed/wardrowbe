'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { api } from '@/lib/api';
import { useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import { queryKeys } from '@/lib/hooks/query-keys';
import type { Outfit } from '@/lib/hooks/use-outfits';

export interface Stay {
  id: string;
  city: string;
  home_id: string | null;
  start_date: string;
  end_date: string;
}

export interface StayInput {
  city: string;
  home_id?: string | null;
  start_date: string;
  end_date: string;
}

export interface DayForecast {
  temp_min: number;
  temp_max: number;
  precipitation_chance: number;
  humidity: number | null;
  uv_index: number | null;
  condition: string;
}

export interface WeatherDay {
  date: string;
  city: string | null;
  // The day's city comes from a stay rather than the current home.
  away: boolean;
  stay_id: string | null;
  home_id: string | null;
  forecast: DayForecast | null;
}

function useReady() {
  const { status } = useSession();
  useSetTokenIfAvailable();
  return status !== 'loading';
}

export function useStays() {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.stays,
    queryFn: () => api.get<Stay[]>('/stays'),
    enabled: ready,
  });
}

// Today and the next days, each with where the person will be and its forecast.
export function useWeatherDays(days = 7) {
  const ready = useReady();
  return useQuery({
    queryKey: queryKeys.weatherDays(days),
    queryFn: () =>
      api.get<{ days: WeatherDay[] }>('/weather/days', { params: { days: String(days) } }),
    enabled: ready,
    staleTime: 15 * 60 * 1000,
    retry: false,
    meta: { toastsOwnErrors: true },
  });
}

function useInvalidateStays() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.stays });
    queryClient.invalidateQueries({ queryKey: queryKeys.everyWeatherDays });
  };
}

export function useCreateStay() {
  const invalidate = useInvalidateStays();
  return useMutation({
    mutationFn: (input: StayInput) => api.post<Stay>('/stays', input),
    onSuccess: invalidate,
  });
}

export function useDeleteStay() {
  const invalidate = useInvalidateStays();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/stays/${id}`),
    onSuccess: invalidate,
  });
}

// Suggest an outfit for that day's weather where the person will be, saved to that day.
export function usePlanDayOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (day: string) => api.post<Outfit>(`/weather/days/${day}/outfit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarOutfits.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.pendingOutfits.all });
    },
  });
}
