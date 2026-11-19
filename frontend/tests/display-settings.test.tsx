import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DisplaySettings } from '@/components/wardrobe/display-settings'

const setTheme = vi.fn()
let theme: string | undefined

vi.mock('next-themes', () => ({ useTheme: () => ({ theme, setTheme }) }))

beforeEach(() => {
  setTheme.mockReset()
  theme = undefined
})

describe('DisplaySettings', () => {
  it('follows the phone until a look is chosen', () => {
    render(<DisplaySettings />)

    expect(screen.getByRole('radio', { name: 'system' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'dark' })).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the saved look and switches to the one tapped', () => {
    theme = 'dark'
    render(<DisplaySettings />)

    expect(screen.getByRole('radio', { name: 'dark' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(screen.getByRole('radio', { name: 'light' }))

    expect(setTheme).toHaveBeenCalledWith('light')
  })
})
