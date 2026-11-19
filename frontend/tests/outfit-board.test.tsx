import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BoardView, EditableBoard } from '@/components/wardrobe/outfit-board'

const pieces = [
  { item_id: 'top', x: 20, y: 10, w: 40, z: 2 },
  { item_id: 'shoes', x: 30, y: 85, w: 30, z: 1 },
]
const images = { top: '/top.webp', shoes: '/shoes.webp' }

describe('BoardView', () => {
  it('draws the pieces where they were saved, lowest first', () => {
    const { container } = render(<BoardView background="#f6f1e7" pieces={pieces} images={images} />)
    const imgs = container.querySelectorAll('img')
    expect(imgs[0].getAttribute('src')).toBe('/shoes.webp')
    expect((imgs[1] as HTMLElement).style.left).toBe('20%')
  })
})

describe('EditableBoard', () => {
  it('brings the chosen piece to the front and removes it on request', () => {
    const onChange = vi.fn()
    const onRemove = vi.fn()
    render(
      <EditableBoard background="#ffffff" pieces={pieces} images={images} selected="shoes"
        onSelect={vi.fn()} onChange={onChange} onRemove={onRemove} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'front' }))
    expect(onChange.mock.calls[0][0].find((p: { item_id: string }) => p.item_id === 'shoes').z).toBe(3)
    fireEvent.click(screen.getByRole('button', { name: 'remove' }))
    expect(onRemove).toHaveBeenCalledWith('shoes')
  })
})
