import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LaundryScreen } from '@/components/wardrobe/laundry-screen'

const mutate = vi.fn()
const item = (id: string, name: string) => ({ id, name, type: 'shirt', thumbnail_url: null })

vi.mock('@/lib/hooks/use-homes', () => ({ useHomes: () => ({ data: [{ id: 'h1', is_current: true }] }) }))
vi.mock('@/lib/hooks/use-translated-constants', () => ({ useTypeLabel: () => (type: string) => type }))
vi.mock('@/lib/hooks/use-laundry', () => ({
  useLaundry: () => ({
    data: { to_wash: [item('a', 'Teal kurti'), item('b', 'White shirt')], wash: [item('c', 'Orange kurti')], dry: [] },
    isLoading: false,
  }),
  useLaundryStates: () => ({ data: new Map() }),
  useMoveLaundry: () => ({ mutate, isPending: false }),
}))

describe('LaundryScreen', () => {
  it('moves the ticked clothes into the wash', () => {
    render(<LaundryScreen />)
    const washing = screen.getByRole('button', { name: 'actions.wash' })
    expect((washing as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'selectAll' }))
    fireEvent.click(washing)
    expect(mutate.mock.calls[0][0]).toEqual({ itemIds: ['a', 'b'], to: 'wash' })
  })

  it('brings clothes back from the wash', () => {
    mutate.mockClear()
    render(<LaundryScreen />)
    fireEvent.click(screen.getByRole('tab', { name: /tabs.wash/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Orange kurti' }))
    fireEvent.click(screen.getByRole('button', { name: 'actions.back' }))
    expect(mutate.mock.calls[0][0]).toEqual({ itemIds: ['c'], to: 'back' })
  })
})
