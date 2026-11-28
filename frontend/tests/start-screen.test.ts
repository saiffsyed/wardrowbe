import { describe, expect, it } from 'vitest'
import { startHref } from '@/lib/start-screen'

describe('startHref', () => {
  it('opens the chosen screen and falls back to the wardrobe', () => {
    expect(startHref('lookbook')).toBe('/dashboard/wardrobe?tab=lookbook')
    expect(startHref('plan')).toBe('/dashboard/plan')
    expect(startHref(undefined)).toBe('/dashboard/wardrobe')
    expect(startHref('settings')).toBe('/dashboard/wardrobe')
  })
})
