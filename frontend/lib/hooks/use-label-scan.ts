'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { API_BASE_PATH, ApiError, NetworkError, api, getAccessToken } from '@/lib/api';
import { queryKeys } from '@/lib/hooks/query-keys';
import { applySessionToken, useSetTokenIfAvailable } from '@/lib/hooks/use-session-token';
import type { LabelPhoto, LabelScanResult } from '@/lib/types';

export const MAX_LABEL_PHOTOS_PER_SCAN = 3;

/** The photos kept of an item's labels. */
export function useLabelPhotos(itemId: string) {
  const { status } = useSession();
  useSetTokenIfAvailable();

  return useQuery({
    queryKey: queryKeys.labelPhotos(itemId),
    queryFn: () => api.get<LabelPhoto[]>(`/items/${itemId}/label-photos`),
    enabled: status !== 'loading',
  });
}

/** Sends one to three label photos to be kept and read. Changes none of the item's details. */
export function useScanLabel() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async ({ itemId, files }: { itemId: string; files: File[] }) => {
      const token = session?.accessToken || getAccessToken();
      const formData = new FormData();
      files.forEach((file) => formData.append('images', file));

      let response: Response;
      try {
        // No Content-Type header: the browser sets the multipart boundary itself.
        response = await fetch(`${API_BASE_PATH}/items/${itemId}/label-scan`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      } catch {
        throw new NetworkError('Unable to connect to server. Please try again.');
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = typeof data.detail === 'string' ? data.detail : data.detail?.message;
        throw new ApiError(message || 'Failed to scan the label', response.status, data);
      }
      return (await response.json()) as LabelScanResult;
    },
    onSuccess: (result, { itemId }) => {
      queryClient.setQueryData(queryKeys.labelPhotos(itemId), result.photos);
    },
  });
}

export function useDeleteLabelPhoto() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    meta: { toastsOwnErrors: true },
    mutationFn: async ({ itemId, photoId }: { itemId: string; photoId: string }) => {
      applySessionToken(session);
      return api.delete<void>(`/items/${itemId}/label-photos/${photoId}`);
    },
    onSuccess: (_, { itemId, photoId }) => {
      queryClient.setQueryData<LabelPhoto[]>(queryKeys.labelPhotos(itemId), (photos) =>
        photos?.filter((photo) => photo.id !== photoId)
      );
    },
  });
}
