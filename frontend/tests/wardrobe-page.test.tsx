import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import WardrobePage from '@/app/dashboard/wardrobe/page'

vi.mock('@/components/wardrobe/weather-bar', () => ({ WeatherBar: () => null }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/lib/hooks/use-items', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-items')>()
  const query = { data: undefined, isLoading: false, error: null }
  const mutation = { mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }
  return {
    ...actual,
    useItems: () => ({ ...query, data: { items: [], total: 0 } }),
    useItem: () => query,
    useItemTypes: () => query,
    useTaggingProgress: () => query,
    useReanalyzeItem: () => mutation,
    useCancelAnalysis: () => mutation,
    useBulkDeleteItems: () => mutation,
    useBulkReanalyzeItems: () => mutation,
    useBulkCancelAnalysis: () => mutation,
    useBulkRotateItems: () => mutation,
    useBulkRemoveBackgroundItems: () => mutation,
    useRemoveBackground: () => mutation,
  }
})

vi.mock('@/lib/hooks/use-user', () => ({ useUserTimezone: () => 'UTC' }))
vi.mock('@/lib/hooks/use-homes', () => ({
  useHomes: () => ({ data: [] }),
  useWardrobeFacets: () => ({ data: undefined }),
  useSetCurrentHome: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/hooks/use-wardrobe-categories', () => ({
  useWardrobeCategories: () => ({ data: { customised: false, groups: [], unplaced_types: [] }, refetch: vi.fn() }),
  useCategoryLabel: () => (node: { name?: string | null; key?: string | null; id: string }) =>
    node.name ?? node.key ?? node.id,
}))
vi.mock('@/lib/hooks/use-features', () => ({ useAiUiEnabled: () => true }))

vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useClothingTypes: () => [],
  useClothingColors: () => [],
  useColorLabel: () => (value: string) => value,
  useSubtypeLabel: () => (value: string) => value,
  useTypeLabel: () => (value: string) => value,
}))

vi.mock('@/components/add-item-dialog', () => ({ AddItemDialog: () => null }))
vi.mock('@/components/analysis-queue-panel', () => ({ AnalysisQueuePanel: () => null }))
vi.mock('@/components/item-detail-dialog', () => ({ ItemDetailDialog: () => null }))
vi.mock('@/components/bulk-action-toolbar', () => ({ BulkActionToolbar: () => null }))

describe('WardrobePage header', () => {
  it('names its round buttons, which show only an icon', () => {
    render(<WardrobePage />)

    expect(screen.getByRole('button', { name: 'actions.addItem' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'closet.header.search' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'closet.filters.toggle' })).toBeTruthy()
  })
})
