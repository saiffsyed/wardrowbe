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
// stable = the same object every render (no refetch); otherwise a fresh copy, as a refetch gives.
let stable = true
vi.mock('@/lib/hooks/use-outfits', () => ({
  useOutfit: () => ({ data: stable ? editing : { ...editing } }),
  useInfiniteOutfits: () => ({ data: { pages: [] } }),
}))
const layouts = new Map()
vi.mock('@/lib/hooks/use-outfit-layouts', () => ({
  useOutfitLayouts: () => ({ data: stable ? layouts : new Map(), isFetched: true }),
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

describe('state bugs in the outfit maker', () => {
  beforeEach(() => {
    search = 'edit=o1'
    stable = true
    editing = { ...look }
    push.mockReset()
    patch.mockClear()
  })

  it('bug: the occasion chosen while editing is not sent', async () => {
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    fireEvent.click(screen.getByRole('button', { name: 'wedding' }))
    fireEvent.click(screen.getByRole('button', { name: /saveChanges/ }))
    await vi.waitFor(() => expect(patch).toHaveBeenCalled())
    expect((patch.mock.calls[0][0] as { payload: { occasion?: string } }).payload.occasion).toBe('wedding')
  })

  it('bug: an edited planned look is sent to the Lookbook', async () => {
    editing = { ...look, scheduled_for: '2026-11-22' }
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    fireEvent.click(screen.getByRole('button', { name: /saveChanges/ }))
    await vi.waitFor(() => expect(push).toHaveBeenCalled())
    expect(push).toHaveBeenCalledWith('/dashboard/plan?day=2026-11-22')
  })

  it('bug: a worn look offers Save changes, which then fails', () => {
    editing = { ...look, scheduled_for: '2026-11-19', feedback: { worn_at: '2026-11-19' } }
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    expect(screen.queryByRole('button', { name: /saveChanges/ })).toBeNull()
  })

  it('bug: From Lookbook is offered while editing and overwrites the edited look', () => {
    render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: 'backToPick' }))
    expect(screen.queryByText('fromLookbook')).toBeNull()
  })

  it('bug: a background refetch throws away the edits', () => {
    stable = false
    const { rerender } = render(<OutfitMaker />)
    fireEvent.click(screen.getByRole('button', { name: /next/ }))
    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Wedding teal' } })
    rerender(<OutfitMaker />)
    expect((screen.getByLabelText('name') as HTMLInputElement).value).toBe('Wedding teal')
  }, 10000)
})
