import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PhotoTip } from '@/components/wardrobe/photo-tip'

describe('PhotoTip', () => {
  it('shows one line and opens the full list on request', () => {
    render(<PhotoTip />)
    expect(screen.getByText(/short/)).toBeTruthy()
    expect(screen.queryByText('flat')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'more' }))

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'less' }).getAttribute('aria-expanded')).toBe('true')
  })
})
