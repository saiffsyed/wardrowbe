import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PlannerScreen } from '@/components/wardrobe/planner-screen'

const replace = vi.fn()
let search = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/dashboard/plan',
  useSearchParams: () => new URLSearchParams(search),
}))
vi.mock('@/lib/hooks/use-user', () => ({ useUserToday: () => () => '2026-11-19' }))
vi.mock('@/lib/hooks/use-preferences', () => ({ usePreferences: () => ({ data: { temperature_unit: 'celsius' } }) }))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useWeatherConditionLabel: () => (c: string) => c,
  useOccasionLabel: () => (o: string) => o,
}))
vi.mock('@/lib/hooks/use-outfit-title', () => ({ useOutfitTitle: () => (o: { name?: string }) => o.name ?? 'look' }))
const look = { id: 'o1', name: 'Teal kurti day', scheduled_for: '2026-11-19', status: 'accepted', occasion: 'casual',
  items: [{ id: 'i1', type: 'kurti', position: 0, thumbnail_url: '/k.webp', image_url: null }] }
vi.mock('@/lib/hooks/use-outfits', () => ({
  useOutfits: () => ({ data: { outfits: [look] } }),
  useCalendarOutfits: () => ({ data: { outfits: [look] } }),
  useInfiniteOutfits: () => ({ data: { pages: [] } }),
  useDeleteOutfit: () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/hooks/use-stays', () => ({
  useWeatherDays: () => ({ data: { days: [
    { date: '2026-11-19', city: 'Chennai', away: false, stay_id: null, home_id: null,
      forecast: { temp_min: 26, temp_max: 33, precipitation_chance: 10, humidity: 70, uv_index: 7, condition: 'sunny' } },
  ] } }),
  useStays: () => ({ data: [{ id: 's', city: 'Bangalore', home_id: null, start_date: '2026-11-21', end_date: '2026-11-22' }] }),
  usePlanDayOutfit: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteStay: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateStay: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/hooks/use-studio', () => ({ useCreateStudioOutfit: () => ({ mutate: vi.fn(), isPending: false }) }))
const post = vi.fn(() => Promise.resolve({}))
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => post(...(args as [])) }, getErrorMessage: () => 'error' }))
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }))
vi.mock('@/lib/hooks/use-items', () => ({ useItems: () => ({ data: { items: [] } }) }))
vi.mock('@/lib/hooks/use-laundry', () => ({ useLaundryStates: () => ({ data: new Map() }) }))
vi.mock('@/lib/hooks/use-homes', () => ({ useHomes: () => ({ data: [] }) }))
vi.mock('@/lib/hooks/use-weather', () => ({ useWeather: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-outfit-layouts', () => ({ useOutfitLayouts: () => ({ data: undefined }) }))

describe('PlannerScreen', () => {
  it("shows today's look large, with the weather as one small button", () => {
    search = ''
    render(<PlannerScreen />)
    expect(screen.getByText('Teal kurti day')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'today' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'weatherFor' }).textContent).toContain('33°')
    expect(screen.queryByRole('tablist')).toBeNull()
  })

  it('records "I wore it" after a few seconds, unless undone', () => {
    vi.useFakeTimers()
    search = ''
    render(<PlannerScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'wore' }))
    expect(screen.getByText('wornToday')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'undo' }))
    vi.advanceTimersByTime(6000)
    expect(post).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'wore' }))
    vi.advanceTimersByTime(6000)
    expect(post).toHaveBeenCalledWith('/outfits/o1/feedback', { worn: true })
    vi.useRealTimers()
  })

  it('moves to the tapped day', () => {
    search = ''
    render(<PlannerScreen />)
    fireEvent.click(screen.getByText('20').closest('button')!)
    expect(replace).toHaveBeenCalled()
    expect(replace.mock.calls.at(-1)![0]).toContain('day=2026-11-20')
  })

  it('offers the same two choices on any empty day, and only the Lookbook past the forecast', () => {
    search = 'day=2026-11-20'
    const { unmount } = render(<PlannerScreen />)
    expect(screen.getByRole('button', { name: /pick/ })).toBeTruthy()
    unmount()
    search = 'day=2026-12-30'
    render(<PlannerScreen />)
    expect(screen.queryByRole('button', { name: /^suggest/ })).toBeNull()
    expect(screen.getByRole('button', { name: /pick/ })).toBeTruthy()
  })

  it('shows the whole month with a look on the days that have one', () => {
    search = 'view=month'
    render(<PlannerScreen />)
    expect(screen.getAllByRole('button', { name: /November/ })).toHaveLength(30)
  })
})
