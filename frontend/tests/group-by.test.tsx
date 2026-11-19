import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GroupedItems, groupItems } from '@/components/wardrobe/group-by'
import type { Item } from '@/lib/types'

const item = (id: string, fields: Partial<Item>) => ({ id, type: 'shirt', ...fields }) as Item

describe('groupItems', () => {
  it('keeps runs of the same key together, in the order they arrive', () => {
    const items = [
      item('a', { primary_color: 'blue' }),
      item('b', { primary_color: 'blue' }),
      item('c', { primary_color: 'red' }),
      item('d', {}),
    ]

    expect(groupItems(items, 'color').map((g) => [g.key, g.items.map((i) => i.id)])).toEqual([
      ['blue', ['a', 'b']],
      ['red', ['c']],
      ['', ['d']],
    ])
  })

  it('groups brands however they were typed', () => {
    const items = [item('a', { brand: 'Zara' }), item('b', { brand: ' zara ' })]

    expect(groupItems(items, 'brand')).toHaveLength(1)
  })
})

describe('GroupedItems', () => {
  it('puts a heading with a count over each group, and none when not grouping', () => {
    const items = [item('a', { type: 'saree' }), item('b', { type: 'saree' }), item('c', { type: 'kurta' })]
    const render_ = (list: Item[]) => <p>{list.map((i) => i.id).join(',')}</p>

    const { rerender } = render(
      <GroupedItems items={items} groupBy="type" label={(key) => key.toUpperCase()} render={render_} />
    )
    expect(screen.getByRole('heading', { name: /^SAREE\s*2$/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^KURTA\s*1$/ })).toBeTruthy()
    expect(screen.getByText('a,b')).toBeTruthy()

    rerender(<GroupedItems items={items} groupBy="none" label={(key) => key} render={render_} />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByText('a,b,c')).toBeTruthy()
  })
})
