import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CategorySelect } from '@/components/wardrobe/category-select'
import type { CategoryGroup } from '@/lib/wardrobe-categories'

vi.mock('@/lib/hooks/use-wardrobe-categories', () => ({
  useCategoryLabel: () => (node: { key?: string | null; id: string }) => node.key ?? node.id,
}))

const sub = (id: string, item_count: number) => ({ id, key: id, types: [], kinds: [], item_count })
const GROUPS: CategoryGroup[] = [
  { id: 'indian', key: 'indian', item_count: 5, children: [sub('sarees', 3), sub('lehengas', 2), sub('dupattas', 0)] },
  { id: 'shoes', key: 'shoes', item_count: 2, children: [sub('heels', 2)] },
  { id: 'jewellery', key: 'jewellery', item_count: 0, children: [sub('rings', 0)] },
]

describe('CategorySelect', () => {
  it('lists only groups and sub-groups that hold something', () => {
    render(<CategorySelect groups={GROUPS} value="all" onChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('combobox'))
    const options = screen.getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['anyCategory', 'indian', 'sarees', 'lehengas', 'shoes'])
  })

  it('reports the chosen category', () => {
    const onChange = vi.fn()
    render(<CategorySelect groups={GROUPS} value="all" onChange={onChange} />)
    fireEvent.click(screen.getByRole('combobox'))
    fireEvent.click(screen.getByRole('option', { name: 'sarees' }))
    expect(onChange).toHaveBeenCalledWith('sarees')
  })
})
