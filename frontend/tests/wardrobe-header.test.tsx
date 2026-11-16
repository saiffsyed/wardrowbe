import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WardrobeHeader } from '@/components/wardrobe/wardrobe-header'
import { MobileMenuProvider } from '@/components/wardrobe/mobile-menu'
import type { Home } from '@/lib/types'

vi.mock('@/lib/hooks/use-homes', () => ({
  useSetCurrentHome: () => ({ mutate: vi.fn(), isPending: false }),
}))

const HOMES = [
  { id: 'home-1', name: 'Chennai', city: 'Chennai', is_current: true, item_count: 4 },
  { id: 'home-2', name: 'Europe', city: 'Amsterdam', is_current: false, item_count: 3 },
] as Home[]

function setup(overrides: Partial<Parameters<typeof WardrobeHeader>[0]> = {}) {
  const props = {
    homes: HOMES,
    scope: 'here' as const,
    onScopeChange: vi.fn(),
    category: 'all' as const,
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
  const openMenu = vi.fn()
  render(
    <MobileMenuProvider onOpen={openMenu}>
      <WardrobeHeader {...props} />
    </MobileMenuProvider>
  )
  return { props, openMenu }
}

describe('WardrobeHeader', () => {
  it('shows the home you are in and marks the chosen category', () => {
    setup({ category: 'traditional' })

    expect(screen.getByRole('button', { name: 'youAreIn' }).textContent).toContain('Chennai')
    expect(screen.getByRole('button', { name: 'traditional' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'all' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the category, home scope, add and menu taps', () => {
    const { props, openMenu } = setup()

    fireEvent.click(screen.getByRole('button', { name: 'shoes' }))
    fireEvent.click(screen.getByRole('button', { name: 'everywhere' }))
    fireEvent.click(screen.getByRole('button', { name: 'actions.addItem' }))
    fireEvent.click(screen.getByRole('button', { name: 'openSidebar' }))

    expect(props.onCategoryChange).toHaveBeenCalledWith('shoes')
    expect(props.onScopeChange).toHaveBeenCalledWith('all')
    expect(props.onAdd).toHaveBeenCalled()
    expect(openMenu).toHaveBeenCalled()
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
