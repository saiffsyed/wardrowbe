import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MoreScreen } from '@/components/wardrobe/more-screen'
import { isReachedFromMore } from '@/lib/more-routes'

vi.mock('@/lib/hooks/use-auth', () => ({
  useAuth: () => ({ user: { display_name: 'Saiff', email: 'saiff@example.com' } }),
}))

describe('MoreScreen', () => {
  it('shows who is signed in, three features and the settings rows', () => {
    render(<MoreScreen />)

    expect(screen.getByText('Saiff')).toBeTruthy()
    const hrefs = screen.getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual([
      '/dashboard/more/account',
      '/dashboard/analytics',
      '/dashboard/history',
      '/dashboard/family',
      '/dashboard/more/homes',
      '/dashboard/more/categories',
      '/dashboard/more/display',
      '/dashboard/settings',
      '/dashboard/notifications',
      '/dashboard/more/account',
    ])
    // Screens decided against are not offered.
    for (const hidden of ['/dashboard/pairings', '/dashboard/learning', '/dashboard/family/feed']) {
      expect(hrefs).not.toContain(hidden)
    }
  })
})

describe('isReachedFromMore', () => {
  it('covers More, its own screens and the settings it links to, not the main tabs', () => {
    expect(isReachedFromMore('/dashboard/more')).toBe(true)
    expect(isReachedFromMore('/dashboard/more/homes')).toBe(true)
    expect(isReachedFromMore('/dashboard/settings')).toBe(true)
    expect(isReachedFromMore('/dashboard/wardrobe')).toBe(false)
    expect(isReachedFromMore('/dashboard')).toBe(false)
    expect(isReachedFromMore('/dashboard/settingsx')).toBe(false)
  })
})
