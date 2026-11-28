import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PressToSelect } from '@/components/wardrobe/press-to-select'

function setup(selecting = false, selected = false) {
  const onSelect = vi.fn()
  const open = vi.fn()
  render(
    <PressToSelect selecting={selecting} selected={selected} onSelect={onSelect}>
      <button type="button" onClick={open}>
        Kurta
      </button>
    </PressToSelect>
  )
  return { onSelect, open, tile: screen.getByText('Kurta') }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('PressToSelect', () => {
  it('opens the piece on a quick tap', () => {
    const { onSelect, open, tile } = setup()
    fireEvent.pointerDown(tile, { button: 0, clientX: 5, clientY: 5 })
    act(() => vi.advanceTimersByTime(100))
    fireEvent.pointerUp(tile)
    fireEvent.click(tile)
    expect(open).toHaveBeenCalledOnce()
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects on press and hold, without opening the piece', () => {
    const { onSelect, open, tile } = setup()
    fireEvent.pointerDown(tile, { button: 0, clientX: 5, clientY: 5 })
    act(() => vi.advanceTimersByTime(500))
    fireEvent.pointerUp(tile)
    fireEvent.click(tile)
    expect(onSelect).toHaveBeenCalledWith(true)
    expect(open).not.toHaveBeenCalled()
  })

  it('does not select when the finger moves (a scroll)', () => {
    const { onSelect, tile } = setup()
    fireEvent.pointerDown(tile, { button: 0, clientX: 5, clientY: 5 })
    fireEvent.pointerMove(tile, { clientX: 5, clientY: 60 })
    act(() => vi.advanceTimersByTime(500))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('ticks and unticks with a tap while selecting', () => {
    const { onSelect, open, tile } = setup(true, true)
    fireEvent.click(tile)
    expect(onSelect).toHaveBeenCalledWith(false)
    expect(open).not.toHaveBeenCalled()
  })
})
