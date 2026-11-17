'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { applySessionToken, useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import type { CategoryTreeInput, CustomKind, WardrobeCategories } from '@/lib/wardrobe-categories';

/** The person's categories with how many of their items each holds (in one home, if given). */
export function useWardrobeCategories(homeId?: string) {
  const { status } = useSession();
  useSetTokenIfAvailable();

  return useQuery({
    queryKey: queryKeys.wardrobeCategories.home(homeId),
    queryFn: () =>
      api.get<WardrobeCategories>('/wardrobe/categories', homeId ? { params: { home_id: homeId } } : undefined),
    enabled: status !== 'loading',
  });
}

export function useSaveWardrobeCategories() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async (tree: CategoryTreeInput) => {
      applySessionToken(session);
      return api.put<WardrobeCategories>('/wardrobe/categories', tree);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.wardrobeCategories.home(undefined), saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeCategories.all });
      // A category's contents changed, so any list filtered by one is out of date.
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}

export function useResetWardrobeCategories() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async () => {
      applySessionToken(session);
      return api.delete<void>('/wardrobe/categories');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeCategories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}

export function useAddCustomKind() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async (kind: { name: string; base_type: string }) => {
      applySessionToken(session);
      return api.post<CustomKind>('/wardrobe/kinds', kind);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeCategories.all }),
  });
}

export function useDeleteCustomKind() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async (id: string) => {
      applySessionToken(session);
      return api.delete<void>(`/wardrobe/kinds/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.wardrobeCategories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}

/** A category's name: what the person typed, else the built-in name in their language. */
export function useCategoryLabel() {
  const t = useTranslations('wardrobe.closet.categories');
  return useCallback(
    (node: { key?: string | null; name?: string | null; id: string }) => {
      if (node.name) return node.name;
      const key = node.key ?? node.id;
      return t.has(key) ? t(key) : key;
    },
    [t]
  );
}

// What a form's type list uses for one of the person's own kinds. Built-in types never contain
// a colon, so the two cannot collide.
export const CUSTOM_KIND_PREFIX = 'kind:';

/** The person's own kinds of item, and how to turn a form's choice into what an item stores. */
export function useCustomKinds() {
  const { data } = useWardrobeCategories();
  const kinds = data?.kinds ?? [];
  // An item of one of the person's own kinds is its built-in type plus the kind's name as the
  // subtype; a built-in choice is itself and says nothing about the subtype.
  const resolve = useCallback(
    (choice: string): { type: string; subtype?: string } => {
      if (!choice.startsWith(CUSTOM_KIND_PREFIX)) return { type: choice };
      const kind = (data?.kinds ?? []).find((k) => CUSTOM_KIND_PREFIX + k.id === choice);
      return kind ? { type: kind.base_type, subtype: kind.name } : { type: '' };
    },
    [data]
  );
  return { kinds, resolve };
}
