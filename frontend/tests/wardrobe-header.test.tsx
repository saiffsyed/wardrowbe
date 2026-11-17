import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WardrobeHeader } from '@/components/wardrobe/wardrobe-header'
import type { Home } from '@/lib/types'
import type { CategoryGroup } from '@/lib/wardrobe-categories'

vi.mock('@/components/wardrobe/home-weather', () => ({ HomeWeather: () => null }))
vi.mock('@/lib/hooks/use-wardrobe-categories', () => ({
  useCategoryLabel: () => (node: { name?: string | null; key?: string | null; id: string }) =>
    node.name ?? node.key ?? node.id,
}))
vi.mock('@/lib/hooks/use-homes', () => ({
  useSetCurrentHome: () => ({ mutate: vi.fn(), isPending: false }),
}))

const HOMES = [
  { id: 'home-1', name: 'Chennai', city: 'Chennai', is_current: true, item_count: 4 },
  { id: 'home-2', name: 'Europe', city: 'Amsterdam', is_current: false, item_count: 3 },
] as Home[]

const sub = (id: string, item_count: number) => ({ id, key: id, types: [], kinds: [], item_count })
const GROUPS: CategoryGroup[] = [
  { id: 'indian', key: 'indian', item_count: 5, children: [sub('sarees', 3), sub('lehengas', 2), sub('dupattas', 0)] },
  { id: 'shoes', key: 'shoes', item_count: 2, children: [sub('heels', 2), sub('boots', 0)] },
  { id: 'jewellery', key: 'jewellery', item_count: 0, children: [sub('rings', 0)] },
]

function setup(overrides: Partial<Parameters<typeof WardrobeHeader>[0]> = {}) {
  const props = {
    homes: HOMES,
    scope: 'here' as const,
    onScopeChange: vi.fn(),
    groups: GROUPS,
    category: 'all',
    onCategoryChange: vi.fn(),
    search: '',
    onSearchChange: vi.fn(),
    filterCount: 0,
    filtersOpen: false,
    onToggleFilters: vi.fn(),
    onAdd: vi.fn(),
    total: 7,
    ...overrides,
  }
  render(<WardrobeHeader {...props} />)
  return { props }
}

describe('WardrobeHeader', () => {
  it('shows the home you are in and only the groups that hold something', () => {
    setup()

    expect(screen.getByRole('button', { name: 'youAreIn' }).textContent).toContain('Chennai')
    expect(screen.getByRole('button', { name: 'all' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'indian' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'shoes' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'jewellery' })).toBeNull()
    // No group is open, so there is no second row.
    expect(screen.queryByRole('button', { name: 'sarees' })).toBeNull()
  })

  it('opens a second row for the chosen group, without its empty sub-groups', () => {
    const { props } = setup({ category: 'indian' })

    expect(screen.getByRole('button', { name: 'indian' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'allOf' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('button', { name: 'dupattas' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'sarees' }))
    expect(props.onCategoryChange).toHaveBeenCalledWith('sarees')
  })

  it('keeps the group marked while one of its sub-groups is chosen', () => {
    setup({ category: 'sarees' })

    expect(screen.getByRole('button', { name: 'indian' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'sarees' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'allOf' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('has no second row for a group with only one kind of thing in it', () => {
    setup({ category: 'shoes' })

    expect(screen.queryByRole('button', { name: 'heels' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'allOf' })).toBeNull()
  })

  it('reports the category, home scope and add taps', () => {
    const { props } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'shoes' }))
    fireEvent.click(screen.getByRole('button', { name: 'everywhere' }))
    fireEvent.click(screen.getByRole('button', { name: 'actions.addItem' }))

    expect(props.onCategoryChange).toHaveBeenCalledWith('shoes')
    expect(props.onScopeChange).toHaveBeenCalledWith('all')
    expect(props.onAdd).toHaveBeenCalled()
  })

  it('keeps search tucked away until asked for, and clears it on close', () => {
    const { props } = setup()
    expect(screen.queryByRole('textbox')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'closet.header.search' }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'kurta' } })
    expect(props.onSearchChange).toHaveBeenCalledWith('kurta')

    fireEvent.click(screen.getByRole('button', { name: 'closet.header.closeSearch' }))
    expect(props.onSearchChange).toHaveBeenLastCalledWith('')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('never hides a search that is in force', () => {
    setup({ search: 'kurta' })

    expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('kurta')
  })

  it('counts the filters in use on the filter button', () => {
    setup({ filterCount: 2 })

    expect(screen.getByRole('button', { name: 'closet.filters.toggle' }).textContent).toBe('2')
  })

  it('offers to set up homes when there are none, and no home switch', () => {
    setup({ homes: [] })

    expect(screen.getByRole('link', { name: 'setUp' }).getAttribute('href')).toBe('/dashboard/settings#homes')
    expect(screen.queryByRole('button', { name: 'everywhere' })).toBeNull()
  })
})
