import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OutfitMaker } from '@/components/wardrobe/outfit-maker'

const push = vi.fn()
let search = 'edit=o1'
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }))

let editing: Record<string, unknown> = {}
// A fresh object on every render, as a refetch gives.
vi.mock('@/lib/hooks/use-outfits', () => ({
  useOutfit: () => ({ data: { ...editing } }),
  useInfiniteOutfits: () => ({ data: { pages: [] } }),
}))
vi.mock('@/lib/hooks/use-outfit-layouts', () => ({
  useOutfitLayouts: () => ({ data: new Map(), isFetched: true }),
  useSaveOutfitLayout: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
const patch = vi.fn((_args: unknown) => Promise.resolve({ id: 'o1' }))
const create = vi.fn(() => Promise.resolve({ id: 'new' }))
vi.mock('@/lib/hooks/use-studio', () => ({
  useCreateStudioOutfit: () => ({ mutateAsync: create, isPending: false }),
  usePatchOutfit: () => ({ mutateAsync: patch, isPending: false }),
}))
vi.mock('@/lib/hooks/use-user', () => ({ useUserToday: () => () => '2026-11-20' }))
vi.mock('@/lib/hooks/use-homes', () => ({ useHomes: () => ({ data: [] }) }))
vi.mock('@/lib/hooks/use-items', () => ({ useItems: () => ({ data: { items: [] }, isLoading: false }) }))
vi.mock('@/lib/hooks/use-wardrobe-categories', () => ({
  useWardrobeCategories: () => ({ data: { groups: [] } }),
  useCategoryLabel: () => () => '',
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({ useOccasionLabel: () => (o: string) => o }))
vi.mock('@/lib/hooks/use-outfit-title', () => ({ useOutfitTitle: () => () => 'look' }))
vi.mock('@/components/wardrobe/dressing-room', () => ({ DressingRoom: () => null }))

const look = {
  id: 'o1',
  name: 'Teal day',
  occasion: 'casual',
  status: 'pending',
  scheduled_for: null as string | null,
  feedback: null as null | { worn_at: string },
  items: [{ id: 'i1', type: 'kurti', position: 0, thumbnail_url: '/k.webp', image_url: '/k.webp' }],
}

describe('OutfitMaker, editing a look', () => {
  beforeEach(() => {
    search = 'edit=o1'
    editing = { ...look }
    push.mockReset()
    patch.mockClear()
  })

  it('keeps changes when the look refetches, and saves the occasion too', async () => {
    const { rerender } = render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Wedding teal' } })
    rerender(<OutfitMaker />)
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Wedding teal')

    fireEvent.click(screen.getByRole('button', { name: 'wedding' }))
    fireEvent.click(screen.getByRole('button', { name: /saveChanges/ }))
    await vi.waitFor(() => expect(patch).toHaveBeenCalled())
    expect(patch.mock.calls[0][0]).toEqual({
      id: 'o1',
      payload: { name: 'Wedding teal', items: ['i1'], occasion: 'wedding' },
    })
  })

  it('a planned look stays on its day', async () => {
    editing = { ...look, scheduled_for: '2026-11-22' }
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    fireEvent.click(screen.getByRole('button', { name: /saveChanges/ }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/dashboard/plan?day=2026-11-22'))
  })

  it('a worn look can only be saved as a new look', () => {
    editing = { ...look, scheduled_for: '2026-11-19', feedback: { worn_at: '2026-11-19' } }
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    expect(screen.getByText('wornNote')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /saveChanges/ })).toBeNull()
    expect(screen.getByRole('button', { name: /saveAsNew/ })).toBeTruthy()
  })

  it('does not offer starting from another look while editing', () => {
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: 'backToPick' }))
    expect(screen.queryByText('fromLookbook')).toBeNull()
  })
})
