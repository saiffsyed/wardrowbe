import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CategoriesSettings } from '@/components/wardrobe/categories-settings'
import type { WardrobeCategories } from '@/lib/wardrobe-categories'

const saveMutate = vi.fn()
const resetMutate = vi.fn()
const addKindMutate = vi.fn()
const deleteKindMutate = vi.fn()
let categories: WardrobeCategories

vi.mock('@/lib/hooks/use-wardrobe-categories', () => ({
  useWardrobeCategories: () => ({ data: categories }),
  useSaveWardrobeCategories: () => ({ mutate: saveMutate, isPending: false }),
  useResetWardrobeCategories: () => ({ mutate: resetMutate, isPending: false }),
  useAddCustomKind: () => ({ mutate: addKindMutate, isPending: false }),
  useDeleteCustomKind: () => ({ mutate: deleteKindMutate, isPending: false }),
  useCategoryLabel: () => (node: { name?: string | null; key?: string | null; id: string }) =>
    node.name ?? node.key ?? node.id,
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useClothingTypes: () =>
    ['saree', 'saree-blouse', 'kurta', 'shirt', 'lehenga'].map((value) => ({ value, label: value })),
}))

function tree(): WardrobeCategories {
  return {
    customised: false,
    unplaced_types: [],
    kinds: [],
    groups: [
      {
        id: 'indian',
        key: 'indian',
        item_count: 0,
        children: [
          { id: 'sarees', key: 'sarees', types: ['saree', 'saree-blouse'], kinds: [], item_count: 0 },
          { id: 'kurtas-suits', key: 'kurtas-suits', types: ['kurta'], kinds: [], item_count: 0 },
        ],
      },
      { id: 'western', key: 'western', item_count: 0, children: [{ id: 'tops', key: 'tops', types: ['shirt'], kinds: [], item_count: 0 }] },
    ],
  }
}

function saved() {
  return saveMutate.mock.calls.at(-1)![0]
}

beforeEach(() => {
  saveMutate.mockReset()
  resetMutate.mockReset()
  addKindMutate.mockReset()
  deleteKindMutate.mockReset()
  categories = tree()
})

describe('CategoriesSettings', () => {
  it('lists each group with its sub-groups and what they hold', () => {
    render(<CategoriesSettings />)

    // Two groups and three sub-groups, each a row that opens for editing.
    expect(screen.getAllByRole('button', { name: 'editNamed' })).toHaveLength(5)
    expect(screen.getByText('saree, saree-blouse')).toBeTruthy()
    expect(screen.getByText('kurtas-suits')).toBeTruthy()
  })

  it('adds a sub-group and moves a ticked kind of item out of where it was', () => {
    render(<CategoriesSettings />)
    fireEvent.click(screen.getAllByRole('button', { name: 'addSubgroup' })[0])

    fireEvent.change(screen.getByLabelText('name'), { target: { value: '  Pattu   sarees ' } })
    fireEvent.click(document.getElementById('category-type-saree')!)
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    const indian = saved().groups[0]
    expect(indian.children.map((child: { name?: string; key?: string }) => child.name ?? child.key)).toEqual([
      'sarees',
      'kurtas-suits',
      'Pattu sarees',
    ])
    expect(indian.children[0].types).toEqual(['saree-blouse'])
    expect(indian.children[2].types).toEqual(['saree'])
    // Counts are the server's to work out; they are not sent back.
    expect(indian.children[2]).not.toHaveProperty('item_count')
  })

  it('renames a built-in category by giving it a name, keeping its key', () => {
    render(<CategoriesSettings />)
    fireEvent.click(screen.getAllByRole('button', { name: 'editNamed' })[1])

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Silk sarees' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(saved().groups[0].children[0]).toEqual({
      id: 'sarees',
      key: 'sarees',
      name: 'Silk sarees',
      types: ['saree', 'saree-blouse'],
      kinds: [],
    })
  })

  it('adds a main group', () => {
    render(<CategoriesSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'addGroup' }))

    fireEvent.change(screen.getByLabelText('name'), { target: { value: 'Office' } })
    fireEvent.click(screen.getByRole('button', { name: 'save' }))

    expect(saved().groups).toHaveLength(3)
    expect(saved().groups[2]).toMatchObject({ name: 'Office', children: [] })
  })

  it('deletes only on the second tap', () => {
    render(<CategoriesSettings />)
    fireEvent.click(screen.getAllByRole('button', { name: 'editNamed' })[1])

    fireEvent.click(screen.getByRole('button', { name: 'delete' }))
    expect(saveMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'deleteConfirm' }))

    expect(saved().groups[0].children.map((child: { id: string }) => child.id)).toEqual(['kurtas-suits'])
  })

  it('offers the way back to the standard categories only once they were changed', () => {
    const { rerender } = render(<CategoriesSettings />)
    expect(screen.queryByRole('button', { name: 'reset' })).toBeNull()

    categories = { ...tree(), customised: true, unplaced_types: ['shirt'] }
    rerender(<CategoriesSettings />)
    expect(screen.getByText('unplaced')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'reset' }))
    expect(resetMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'resetConfirm' }))
    expect(resetMutate).toHaveBeenCalled()
  })

  it('adds a kind of item of your own, only once it has a name', () => {
    render(<CategoriesSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'addKind' }))

    const save = screen.getByRole('button', { name: 'save' })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText('name'), { target: { value: ' Pattu   pavadai ' } })
    // The closest built-in kind is still to be chosen.
    expect(save).toBeDisabled()
    expect(addKindMutate).not.toHaveBeenCalled()
  })

  it('lists your own kinds, lets one be ticked into a category, and deletes on the second tap', () => {
    const own = { id: 'k1', name: 'Pattu pavadai', base_type: 'lehenga', item_count: 2 }
    categories = { ...tree(), kinds: [own] }
    render(<CategoriesSettings />)

    expect(screen.getByText('Pattu pavadai')).toBeTruthy()
    expect(screen.getByText('kindOf')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'deleteKind' }))
    expect(deleteKindMutate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'deleteKind' }))
    expect(deleteKindMutate.mock.calls[0][0]).toBe('k1')

    fireEvent.click(screen.getAllByRole('button', { name: 'editNamed' })[1])
    fireEvent.click(document.getElementById('category-kind-k1')!)
    fireEvent.click(screen.getByRole('button', { name: 'save' }))
    expect(saved().groups[0].children[0].kinds).toEqual(['k1'])
  })
})
