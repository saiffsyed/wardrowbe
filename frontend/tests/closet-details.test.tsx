import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClosetDetails } from '@/components/wardrobe/closet-details'
import { activeFacetCount } from '@/components/wardrobe/facet-filters'
import type { Item } from '@/lib/types'

const mutate = vi.fn()
let labelPhotos: { id: string; image_url: string; thumbnail_url: string }[] = []

vi.mock('@/lib/hooks/use-homes', () => ({
  useHomes: () => ({
    data: [
      { id: 'home-1', name: 'Chennai home', city: 'Chennai', is_current: true, item_count: 1 },
      { id: 'home-2', name: 'Kadiri home', city: 'Kadiri', is_current: false, item_count: 0 },
    ],
  }),
  useUpdateClosetDetails: () => ({ mutate, isPending: false }),
}))
vi.mock('@/lib/hooks/use-label-scan', () => ({
  MAX_LABEL_PHOTOS_PER_SCAN: 3,
  useLabelPhotos: () => ({ data: labelPhotos }),
  useDeleteLabelPhoto: () => ({ mutate: vi.fn(), isPending: false }),
  useScanLabel: () => ({ mutate: vi.fn(), isPending: false, reset: vi.fn() }),
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useMaterialLabel: () => (value: string) => value,
  useOccasionLabel: () => (value: string) => value,
}))

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    user_id: 'user-1',
    home_id: 'home-1',
    type: 'sherwani',
    brand: 'Tailor-made',
    tags: {
      size: '40',
      size_system: 'IN',
      purchase_place: 'Chennai, India',
      composition: [
        { material: 'cotton', percent: 30 },
        { material: 'silk', percent: 70 },
      ],
      occasions: ['wedding'],
    },
    ...overrides,
  } as Item
}

function lastEdits() {
  return mutate.mock.calls.at(-1)![0].edits
}

beforeEach(() => {
  mutate.mockReset()
  labelPhotos = []
})

describe('ClosetDetails', () => {
  it('shows the label details, largest material first', () => {
    render(<ClosetDetails item={item()} />)

    expect(screen.getByText('Chennai home')).toBeTruthy()
    expect(screen.getByText('40 · IN')).toBeTruthy()
    expect(screen.getByText('Chennai, India')).toBeTruthy()
    expect(screen.getByText('wedding')).toBeTruthy()
    const shares = screen.getAllByRole('listitem').map((li) => li.textContent)
    expect(shares).toEqual(['wedding', '70% silk', '30% cotton'])
  })

  it('saves edits, clearing what was emptied and keeping a half-typed occasion', () => {
    render(<ClosetDetails item={item()} />)
    fireEvent.click(screen.getByRole('button', { name: 'edit' }))

    fireEvent.change(screen.getByLabelText('sizeSystem'), { target: { value: '  ' } })
    fireEvent.change(screen.getByLabelText('fitNote'), { target: { value: ' Slim at the shoulders ' } })
    fireEvent.change(screen.getByLabelText('occasions'), { target: { value: '  Festive ' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(mutate.mock.calls.at(-1)![0].id).toBe('item-1')
    expect(lastEdits()).toEqual({
      home_id: 'home-1',
      brand: 'Tailor-made',
      tags: {
        size: '40',
        size_system: null,
        fit_note: 'Slim at the shoulders',
        purchase_place: 'Chennai, India',
        care_instructions: null,
        composition: [
          { material: 'cotton', percent: 30 },
          { material: 'silk', percent: 70 },
        ],
        occasions: ['wedding', 'festive'],
      },
    })
  })

  it('shows the brand, the wash status and care one instruction to a row', () => {
    render(
      <ClosetDetails
        item={item({
          needs_wash: true,
          tags: { care_instructions: 'Dry clean only, do not tumble dry; cool iron' },
        } as Partial<Item>)}
      />
    )

    expect(screen.getByText('Tailor-made')).toBeTruthy()
    expect(screen.getByText('statusNeedsWash')).toBeTruthy()
    const care = screen.getByRole('list', { name: 'care' })
    expect(Array.from(care.children).map((li) => li.textContent)).toEqual([
      'Dry clean only',
      'Do not tumble dry',
      'Cool iron',
    ])
  })

  it('offers a label scan and shows the label photos that were kept', () => {
    labelPhotos = [{ id: 'photo-1', image_url: '/full.jpg', thumbnail_url: '/thumb.jpg' }]
    render(<ClosetDetails item={item()} />)

    expect(screen.getByRole('button', { name: 'scanLabel' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'openPhoto' }))

    expect(screen.getByRole('img', { name: 'photoNumber' }).getAttribute('src')).toBe('/full.jpg')
    expect(screen.getByRole('button', { name: 'deletePhoto' })).toBeTruthy()
  })

  it('will not save material percentages that add up to more than 100', () => {
    render(<ClosetDetails item={item()} />)
    fireEvent.click(screen.getByRole('button', { name: 'edit' }))

    fireEvent.change(screen.getAllByLabelText('materialPercent')[0], { target: { value: '80' } })
    // The first row is cotton: 80 + 70 is over 100.
    expect(screen.getByRole('alert').textContent).toBe('tooMuch')
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(mutate).not.toHaveBeenCalled()
  })

  it('drops half-filled material rows and accepts a comma decimal and a percent sign', () => {
    render(<ClosetDetails item={item({ tags: { colors: [], style: [], season: [] }, home_id: null })} />)
    fireEvent.click(screen.getByRole('button', { name: 'add' }))

    fireEvent.click(screen.getByRole('button', { name: 'addMaterial' }))
    fireEvent.click(screen.getByRole('button', { name: 'addMaterial' }))
    const names = screen.getAllByLabelText('materialName')
    const percents = screen.getAllByLabelText('materialPercent')
    fireEvent.change(names[0], { target: { value: ' Wool ' } })
    fireEvent.change(percents[0], { target: { value: '97,5%' } })
    fireEvent.change(names[1], { target: { value: 'elastane' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(lastEdits().tags.composition).toEqual([{ material: 'wool', percent: 97.5 }])
    expect(lastEdits().tags.occasions).toBeNull()
  })
})

describe('activeFacetCount', () => {
  it('counts only the filters that are set', () => {
    expect(activeFacetCount({})).toBe(0)
    expect(activeFacetCount({ occasion: 'wedding', brand: undefined, season: 'summer' })).toBe(2)
  })
})
