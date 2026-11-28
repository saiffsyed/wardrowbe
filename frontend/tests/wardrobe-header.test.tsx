import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WardrobeHeader } from '@/components/wardrobe/wardrobe-header'
import type { Home } from '@/lib/types'
import type { CategoryGroup } from '@/lib/wardrobe-categories'

vi.mock('@/components/wardrobe/stay-home-prompt', () => ({ StayHomePrompt: () => null }))
vi.mock('@/components/wardrobe/home-weather', () => ({ HomeWeather: () => null }))
vi.mock('@/components/wardrobe/weather-bar', () => ({ WeatherBar: () => null }))
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
  it('shows the home you are in, and no category chips (they are in the filter panel)', () => {
    setup()

    expect(screen.getByRole('button', { name: 'youAreIn' }).textContent).toContain('Chennai')
    expect(screen.queryByRole('button', { name: 'indian' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'all' })).toBeNull()
  })

  it('reports the add tap, leaving the home scope to the filter panel', () => {
    const { props } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'actions.addItem' }))

    expect(props.onAdd).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'everywhere' })).toBeNull()
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

describe('HomesFilter', () => {
  it('switches between this home and all homes', async () => {
    const { HomesFilter } = await import('@/components/wardrobe/home-bar')
    const onScopeChange = vi.fn()
    render(
      <HomesFilter
        homes={[{ id: 'h1', name: 'Chennai', city: 'Chennai', is_current: true } as never]}
        scope="here"
        onScopeChange={onScopeChange}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'everywhere' }))
    expect(onScopeChange).toHaveBeenCalledWith('all')
  })
})

describe('AppTopBar', () => {
  it('shows the logo, with the app name for screen readers, beside the home button', () => {
    setup()
    expect(screen.getByText('Wardrobe')).toBeTruthy()
    expect(screen.getByText('Chennai')).toBeTruthy()
  })
})
