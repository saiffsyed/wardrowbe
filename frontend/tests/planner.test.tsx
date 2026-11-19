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
vi.mock('@/lib/hooks/use-translated-constants', () => ({ useWeatherConditionLabel: () => (c: string) => c }))
vi.mock('@/lib/hooks/use-outfit-title', () => ({ useOutfitTitle: () => (o: { name?: string }) => o.name ?? 'look' }))
const look = { id: 'o1', name: 'Teal kurti day', scheduled_for: '2026-11-19', status: 'accepted', occasion: 'casual',
  items: [{ id: 'i1', type: 'kurti', position: 0, thumbnail_url: '/k.webp', image_url: null }] }
vi.mock('@/lib/hooks/use-outfits', () => ({
  useOutfits: () => ({ data: { outfits: [look] } }),
  useCalendarOutfits: () => ({ data: { outfits: [look] } }),
  useInfiniteOutfits: () => ({ data: { pages: [] } }),
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
vi.mock('@/lib/hooks/use-homes', () => ({ useHomes: () => ({ data: [] }) }))
vi.mock('@/lib/hooks/use-weather', () => ({ useWeather: () => ({ data: undefined }) }))

describe('PlannerScreen', () => {
  it("shows today's planned look with the day's weather line and place", () => {
    search = ''
    render(<PlannerScreen />)
    expect(screen.getByText('Teal kurti day')).toBeTruthy()
    expect(screen.getByText(/sunny/)).toBeTruthy()
    expect(screen.getByText('beIn')).toBeTruthy()
  })

  it('moves to the tapped day', () => {
    search = ''
    render(<PlannerScreen />)
    fireEvent.click(screen.getByText('20').closest('button')!)
    expect(replace).toHaveBeenCalled()
    expect(replace.mock.calls.at(-1)![0]).toContain('day=2026-11-20')
  })

  it('shows the whole month with a look on the days that have one', () => {
    search = 'view=month'
    render(<PlannerScreen />)
    expect(screen.getAllByRole('button', { name: /November/ })).toHaveLength(30)
  })
})
