import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StaysRow } from '@/components/wardrobe/stays-row'
import { StayHomePrompt } from '@/components/wardrobe/stay-home-prompt'

const day = (date: string, city: string, away = false, extra = {}) => ({
  date, city, away, stay_id: away ? 'stay-1' : null, home_id: null, forecast: null, ...extra,
})
let days = [
  day('2026-11-19', 'Chennai'), day('2026-11-20', 'Chennai'),
  day('2026-11-21', 'Bangalore', true), day('2026-11-22', 'Bangalore', true),
  day('2026-11-23', 'Chennai'), day('2026-11-24', 'Chennai'), day('2026-11-25', 'Chennai'),
]
const setCurrent = vi.fn()

vi.mock('@/lib/hooks/use-stays', () => ({
  useWeatherDays: () => ({ data: { days } }),
  useDeleteStay: () => ({ mutate: vi.fn() }),
  useCreateStay: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/hooks/use-homes', () => ({
  useHomes: () => ({ data: [
    { id: 'home-1', name: 'Chennai', city: 'Chennai', is_current: true },
    { id: 'home-2', name: 'Europe', city: 'Amsterdam', is_current: false },
  ] }),
  useSetCurrentHome: () => ({ mutate: setCurrent, isPending: false }),
}))

describe('StaysRow', () => {
  it('joins neighbouring days in one place into one bar', () => {
    render(<StaysRow />)
    expect(screen.getAllByText('Chennai')).toHaveLength(2)
    expect(screen.getAllByText('Bangalore')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'remove' })).toBeTruthy()
  })
})

describe('StayHomePrompt', () => {
  it('offers the clothes of the home you are staying at, and switches only when asked', () => {
    days = [day('2026-11-19', 'Europe', true, { home_id: 'home-2' })]
    render(<StayHomePrompt />)
    expect(setCurrent).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'promptYes' }))
    expect(setCurrent.mock.calls[0][0]).toBe('home-2')
  })

  it('asks nothing on a stay in a city that is not one of your homes', () => {
    days = [day('2026-11-19', 'Bangalore', true)]
    const { container } = render(<StayHomePrompt />)
    expect(container.textContent).toBe('')
  })
})
