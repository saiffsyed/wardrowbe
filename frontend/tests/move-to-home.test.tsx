import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MoveToHomeButton } from '@/components/wardrobe/move-to-home'
import { openMoreActions } from './open-more-actions'

let homes: { id: string; name: string }[] = []
const mutate = vi.fn()

vi.mock('@/lib/hooks/use-homes', () => ({
  useHomes: () => ({ data: homes }),
  useMoveSelectionToHome: () => ({ mutate, isPending: false }),
}))

beforeEach(() => {
  homes = []
  mutate.mockReset()
})

describe('MoveToHomeButton', () => {
  it('is not offered with fewer than two homes', () => {
    homes = [{ id: 'h1', name: 'Chennai' }]
    render(<MoveToHomeButton getSelection={() => ({ item_ids: ['a'] })} onDone={vi.fn()} />)

    expect(screen.queryByRole('button', { name: 'moveSelected' })).toBeNull()
  })

  it('moves the selection to the home picked', () => {
    homes = [
      { id: 'h1', name: 'Chennai' },
      { id: 'h2', name: 'Europe' },
    ]
    render(<MoveToHomeButton getSelection={() => ({ item_ids: ['a', 'b'] })} onDone={vi.fn()} />)

    openMoreActions('moveSelected')
    screen.getAllByRole('menuitem')[1].click()

    expect(mutate.mock.calls[0][0]).toEqual({ homeId: 'h2', selection: { item_ids: ['a', 'b'] } })
  })
})
