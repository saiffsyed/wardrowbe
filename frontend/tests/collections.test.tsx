import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddToCollectionDialog } from '@/components/wardrobe/add-to-collection'
import { CollectionsTab } from '@/components/wardrobe/collections-tab'
import { CollectionCover } from '@/components/wardrobe/collection-cover'

type Summary = { id: string; name: string; entry_count: number; cover_urls: string[] }
let all: Summary[] = []
let holding: Summary[] = []
const add = vi.fn()
const create = vi.fn()

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('tab=collections'),
}))
vi.mock('@/lib/hooks/use-collections', () => ({
  useCollections: (holder: { itemId?: string } = {}) => ({
    data: holder.itemId ? holding : all,
    isLoading: false,
    isError: false,
  }),
  useAddToCollection: () => ({ mutate: add, isPending: false }),
  useCreateCollection: () => ({ mutate: create, isPending: false }),
}))

beforeEach(() => {
  all = []
  holding = []
  add.mockReset()
  create.mockReset()
})

describe('CollectionsTab', () => {
  it('invites a first collection when there are none', () => {
    render(<CollectionsTab />)
    expect(screen.getByText('emptyTitle')).toBeTruthy()
  })

  it('shows each collection with its count and links to it', () => {
    all = [{ id: 'c1', name: 'Wedding season', entry_count: 3, cover_urls: [] }]
    render(<CollectionsTab />)
    const link = screen.getByRole('link', { name: /Wedding season/ })
    expect(link.getAttribute('href')).toBe('/dashboard/wardrobe/collections/c1')
  })

  it('marks the Collections tab as the current one', () => {
    render(<CollectionsTab />)
    expect(screen.getByRole('link', { name: 'collections' }).getAttribute('aria-current')).toBe('page')
  })
})

describe('AddToCollectionDialog', () => {
  it('adds the item to a collection that does not hold it yet', () => {
    all = [
      { id: 'c1', name: 'Office', entry_count: 1, cover_urls: [] },
      { id: 'c2', name: 'Wedding', entry_count: 2, cover_urls: [] },
    ]
    holding = [all[0]]
    render(
      <AddToCollectionDialog
        open
        onOpenChange={vi.fn()}
        additions={{ item_ids: ['i1'] }}
        holder={{ itemId: 'i1' }}
      />
    )

    const office = screen.getByRole('button', { name: /Office/ }) as HTMLButtonElement
    expect(office.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /Wedding/ }))
    expect(add.mock.calls[0][0]).toEqual({ id: 'c2', additions: { item_ids: ['i1'] } })
  })

  it('creates a collection from the name typed', () => {
    render(
      <AddToCollectionDialog open onOpenChange={vi.fn()} additions={{ outfit_ids: ['o1'] }} />
    )
    fireEvent.change(screen.getByLabelText('nameLabel'), { target: { value: '  Trip  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'create' }))
    expect(create.mock.calls[0][0]).toBe('Trip')
  })
})

describe('CollectionCover', () => {
  it('fills four tiles even with fewer pictures', () => {
    const { container } = render(<CollectionCover urls={['/a.webp']} />)
    expect(container.querySelectorAll('.grid > div')).toHaveLength(4)
    expect(container.querySelectorAll('img')).toHaveLength(1)
  })
})
