import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HomeWeather, weatherIcon } from '@/components/wardrobe/home-weather'
import { CloudRain, Moon, Sun } from 'lucide-react'

let weather: { temperature: number; condition: string; is_day: boolean } | undefined

vi.mock('@/lib/hooks/use-weather', () => ({ useWeather: () => ({ data: weather }) }))
vi.mock('@/lib/hooks/use-preferences', () => ({
  usePreferences: () => ({ data: { temperature_unit: 'celsius' } }),
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useWeatherConditionLabel: () => (c: string) => c,
}))

describe('HomeWeather', () => {
  it('shows nothing until the weather is known', () => {
    weather = undefined
    const { container } = render(<HomeWeather />)
    expect(container.textContent).toBe('')
  })

  it('shows the temperature with the condition for screen readers', () => {
    weather = { temperature: 31.4, condition: 'sunny', is_day: true }
    render(<HomeWeather />)
    expect(screen.getByText(/31/)).toBeTruthy()
    expect(screen.getByText('sunny')).toBeTruthy()
  })

  it('picks an icon for the sky', () => {
    expect(weatherIcon('light-rain')).toBe(CloudRain)
    expect(weatherIcon('clear', false)).toBe(Moon)
    expect(weatherIcon('sunny')).toBe(Sun)
  })
})
