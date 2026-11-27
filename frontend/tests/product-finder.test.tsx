import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { changeRows, ProductFinderDialog } from '@/components/wardrobe/product-finder-dialog'
import type { FindProductResult, ProductMatch } from '@/lib/hooks/use-product-finder'
import type { Item } from '@/lib/types'

const findMutate = vi.fn()
const useMutate = vi.fn()

vi.mock('@/lib/hooks/use-product-finder', () => ({
  useFindProduct: () => ({ mutate: findMutate, isPending: false }),
  useUseProduct: () => ({ mutate: useMutate, isPending: false }),
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useColorLabel: () => (value: string) => value,
}))

const ITEM = { id: 'item-1', name: 'Brown', brand: 'Example', primary_color: 'brown', tags: {} } as unknown as Item

const MATCH: ProductMatch = {
  page_url: 'https://www.shop.example/p/1',
  image_url: 'https://www.shop.example/p/1.jpg',
  thumb: 'data:image/jpeg;base64,AA==',
  title: 'Slim-fit trousers',
  price: 39.95,
  currency: 'EUR',
  colour: 'Grey',
  article_match: true,
}

function finds(result: FindProductResult) {
  findMutate.mockImplementation((_id, options) => options.onSuccess(result))
}

beforeEach(() => {
  findMutate.mockReset()
  useMutate.mockReset()
})

describe('changeRows', () => {
  const labels = { colour: (c: string) => c, money: (a: number | null | undefined) => (a == null ? null : `€${a}`) }

  it('offers the shop name, a known colour and the price', () => {
    expect(changeRows(ITEM, MATCH, labels).map((row) => row.field)).toEqual(['name', 'colour', 'price'])
  })

  it('leaves out a colour the app does not know and details that already match', () => {
    const rows = changeRows({ ...ITEM, name: 'Slim-fit trousers' } as Item, { ...MATCH, colour: 'Moonlight' }, labels)
    expect(rows.map((row) => row.field)).toEqual(['price'])
  })
})

describe('ProductFinderDialog', () => {
  it('searches when opened and shows the matches, the exact one marked', () => {
    finds({ status: 'found', matches: [MATCH], spent_cents: 4, limit_cents: 1000 })
    render(<ProductFinderDialog item={ITEM} open onOpenChange={vi.fn()} />)

    expect(findMutate).toHaveBeenCalledWith('item-1', expect.anything())
    expect(screen.getByText('Slim-fit trousers')).toBeTruthy()
    expect(screen.getByText(/shop\.example/)).toBeTruthy()
    expect(screen.getByText(/sameArticle|Same article/i)).toBeTruthy()
  })

  it('saves only the details left ticked', () => {
    finds({ status: 'found', matches: [MATCH], spent_cents: 4, limit_cents: 1000 })
    render(<ProductFinderDialog item={ITEM} open onOpenChange={vi.fn()} />)

    fireEvent.click(screen.getByText('Slim-fit trousers'))
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(3)
    fireEvent.click(boxes[1]) // colour
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(useMutate.mock.calls[0][0]).toEqual({
      itemId: 'item-1',
      body: {
        page_url: MATCH.page_url,
        image_url: MATCH.image_url,
        name: 'Slim-fit trousers',
        price: 39.95,
        currency: 'EUR',
      },
    })
  })

  it('says so when nothing was found', () => {
    finds({ status: 'nothing', matches: [], spent_cents: 4, limit_cents: 1000 })
    render(<ProductFinderDialog item={ITEM} open onOpenChange={vi.fn()} />)
    expect(screen.getByText(/nothing|not found online/i)).toBeTruthy()
  })
})
