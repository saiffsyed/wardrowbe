import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CataloguePhotoDialog } from '@/components/wardrobe/catalogue-photo-dialog'
import type { CatalogueDraft } from '@/lib/hooks/use-catalogue-photo'
import type { Item } from '@/lib/types'

const make = vi.fn()
const use = vi.fn()
const drop = vi.fn()

vi.mock('@/lib/hooks/use-catalogue-photo', () => ({
  useMakeCataloguePhoto: () => ({ mutate: make, isPending: false }),
  useUseCataloguePhoto: () => ({ mutate: use, isPending: false }),
  useDropCataloguePhoto: () => ({ mutate: drop, isPending: false }),
}))

const ITEM = { id: 'item-1', image_url: '/own.jpg', tags: {} } as unknown as Item
const READY: CatalogueDraft = { status: 'ready', draft_id: 'd1', preview: 'data:image/jpeg;base64,AA==', spent_cents: 7, limit_cents: 1000 }

beforeEach(() => {
  make.mockReset().mockImplementation((_id, options) => options.onSuccess(READY))
  use.mockReset()
  drop.mockReset()
})

describe('CataloguePhotoDialog', () => {
  it('makes a picture when opened and shows it beside the own photo', () => {
    render(<CataloguePhotoDialog item={ITEM} open onOpenChange={vi.fn()} />)
    expect(make).toHaveBeenCalledWith('item-1', expect.anything())
    const images = document.querySelectorAll('img')
    expect([...images].map((img) => img.getAttribute('src'))).toEqual(['/own.jpg', READY.preview])
  })

  it('uses the draft only when asked', () => {
    render(<CataloguePhotoDialog item={ITEM} open onOpenChange={vi.fn()} />)
    expect(use).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /useNew|Use the new photo/i }))
    expect(use.mock.calls[0][0]).toEqual({ itemId: 'item-1', draftId: 'd1' })
  })

  it('drops the draft when the own photo is kept', () => {
    const onOpenChange = vi.fn()
    render(<CataloguePhotoDialog item={ITEM} open onOpenChange={onOpenChange} />)
    fireEvent.click(screen.getByRole('button', { name: /keepMine|Keep mine/i }))
    expect(drop).toHaveBeenCalledWith({ itemId: 'item-1', draftId: 'd1' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('makes another one on Try again, dropping the first', () => {
    render(<CataloguePhotoDialog item={ITEM} open onOpenChange={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /tryAgain|Try again/i }))
    expect(drop).toHaveBeenCalledWith({ itemId: 'item-1', draftId: 'd1' })
    expect(make).toHaveBeenCalledTimes(2)
  })
})
