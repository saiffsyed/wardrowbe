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
  useTypeLabel: () => (t: string) => t,
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
vi.mock('@/lib/hooks/use-laundry', () => ({
  useLaundryStates: () => ({ data: new Map() }),
  useLaundry: () => ({ data: undefined }),
}))
const partnerLook = { id: 'p1', name: 'Pink silk saree', scheduled_for: '2026-11-19', status: 'pending', occasion: 'wedding', feedback: null,
  items: [{ id: 'pi', type: 'saree', position: 0, thumbnail_url: '/s.webp', image_url: null }] }
vi.mock('@/lib/hooks/use-couple', () => ({
  useCouple: () => ({ data: { partner: { id: 'p', display_name: 'Partner Name' }, partner_shares: true, share_plans: true, choices: [] } }),
  usePartnerPlans: () => ({ data: [partnerLook] }),
}))
vi.mock('@/lib/hooks/use-homes', () => ({
  useHomes: () => ({ data: [] }),
  useSetCurrentHome: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/hooks/use-weather', () => ({ useWeather: () => ({ data: undefined }) }))
vi.mock('@/lib/hooks/use-outfit-layouts', () => ({ useOutfitLayouts: () => ({ data: undefined }) }))

describe('partner on the Plan screen', () => {
  it('shows the partner\'s look small, opens it large, and the eye hides it', () => {
    search = ''
    render(<PlannerScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'open' }))
    expect(screen.getByText('Pink silk saree')).toBeTruthy()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'hide' }))
    expect(screen.queryByRole('button', { name: 'open' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'show' }))
    expect(screen.getByRole('button', { name: 'open' })).toBeTruthy()
  })
})
