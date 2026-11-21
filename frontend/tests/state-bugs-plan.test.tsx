import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
let dayLooks: unknown[] = [look]
vi.mock('@/lib/hooks/use-outfits', () => ({
  useOutfits: () => ({ data: { outfits: dayLooks } }),
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


// Each bug found in the review of the app's state handling, reproduced through the screen,
// so the same test runs on the code before and after the fix.
describe('state bugs on the Plan screen', () => {
  beforeEach(() => {
    search = ''
    dayLooks = [look]
    post.mockClear()
  })

  it('bug: closing the app during the Undo wait loses the wear', async () => {
    vi.useFakeTimers()
    render(<PlannerScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'wore' }))
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('pagehide'))
    await vi.advanceTimersByTimeAsync(0)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    const sent = post.mock.calls.length
    await vi.advanceTimersByTimeAsync(6000)
    vi.useRealTimers()
    expect(sent).toBe(1)
  })

  it('bug: Swap and I wore it come back right after the wear is sent', async () => {
    vi.useFakeTimers()
    // Its own look, so the wear recorded by the test before does not carry over.
    dayLooks = [{ ...look, id: 'o9' }]
    render(<PlannerScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'wore' }))
    await vi.advanceTimersByTimeAsync(6000)
    vi.useRealTimers()
    // The outfit list has not refreshed yet (worn_at still empty).
    expect(screen.queryByRole('button', { name: 'swap' })).toBeNull()
  })

  it('bug: a day with two looks shows the one that was not worn', () => {
    const worn = { ...look, id: 'o2', name: 'The worn one', feedback: { worn_at: '2026-11-19' } }
    dayLooks = [look, worn]
    render(<PlannerScreen />)
    expect(screen.getByText('The worn one')).toBeTruthy()
  })
})
