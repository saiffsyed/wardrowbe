import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LabelScanDialog } from '@/components/wardrobe/label-scan-dialog'
import { editsFromChoices, initialChoices, labelRows } from '@/lib/label-scan'
import type { Item, LabelReading, LabelScanResult } from '@/lib/types'

const scanMutate = vi.fn()
const updateMutate = vi.fn()

vi.mock('@/lib/hooks/use-label-scan', () => ({
  MAX_LABEL_PHOTOS_PER_SCAN: 3,
  useScanLabel: () => ({ mutate: scanMutate, isPending: false, reset: vi.fn() }),
}))
vi.mock('@/lib/hooks/use-homes', () => ({
  useUpdateClosetDetails: () => ({ mutate: updateMutate, isPending: false }),
}))
vi.mock('@/lib/hooks/use-translated-constants', () => ({
  useMaterialLabel: () => (value: string) => value,
}))

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    user_id: 'user-1',
    type: 'shirt',
    brand: 'Fabindia',
    tags: { size: 'M', composition: [{ material: 'cotton', percent: 100 }] },
    ...overrides,
  } as Item
}

const READING: LabelReading = {
  brand: 'fabindia',
  size: '42',
  size_system: 'EU',
  composition: [
    { material: 'linen', percent: 30 },
    { material: 'cotton', percent: 70 },
  ],
  care_instructions: 'Machine wash at 30°C',
}

function scanAnswers(result: LabelScanResult) {
  scanMutate.mockImplementation((_variables, options) => options.onSuccess(result))
}

function photo(name = 'label.jpg') {
  return new File(['x'], name, { type: 'image/jpeg' })
}

beforeEach(() => {
  scanMutate.mockReset()
  updateMutate.mockReset()
  URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`)
  URL.revokeObjectURL = vi.fn()
})

describe('labelRows', () => {
  it('sorts what the label says into new, different and already saved', () => {
    const kinds = Object.fromEntries(labelRows(item(), READING).map((row) => [row.field, row.kind]))

    expect(kinds).toEqual({
      brand: 'same',
      size: 'different',
      size_system: 'new',
      composition: 'different',
      care_instructions: 'new',
    })
  })

  it('leaves out what the label did not give', () => {
    const rows = labelRows(item(), { ...READING, brand: null, composition: [], care_instructions: ' ' })

    expect(rows.map((row) => row.field)).toEqual(['size', 'size_system'])
  })

  it('treats the same materials in another order as already saved', () => {
    const rows = labelRows(item({ tags: { composition: [...READING.composition].reverse() } } as Partial<Item>), READING)

    expect(rows.find((row) => row.field === 'composition')!.kind).toBe('same')
  })
})

describe('editsFromChoices', () => {
  it('by default takes what is new and keeps what is already saved', () => {
    const rows = labelRows(item(), READING)

    expect(editsFromChoices(rows, initialChoices(rows))).toEqual({
      tags: { size_system: 'EU', care_instructions: 'Machine wash at 30°C' },
    })
  })

  it('has nothing to save when every detail is unticked or emptied', () => {
    const rows = labelRows(item(), READING)
    const choices = initialChoices(rows)
    choices.size_system = { use: false, value: 'EU' }
    choices.care_instructions = { use: true, value: '   ' }

    expect(editsFromChoices(rows, choices)).toBeNull()
  })
})

describe('LabelScanDialog', () => {
  it('reads the chosen photos and saves only what was confirmed', () => {
    scanAnswers({ status: 'read', reading: READING, photos: [] })
    render(<LabelScanDialog item={item()} open onOpenChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'read' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('addPhoto', { selector: 'input' }), {
      target: { files: [photo('front.jpg'), photo('back.jpg')] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'read' }))

    expect(scanMutate.mock.calls[0][0].itemId).toBe('item-1')
    expect(scanMutate.mock.calls[0][0].files.map((file: File) => file.name)).toEqual(['front.jpg', 'back.jpg'])
    expect(updateMutate).not.toHaveBeenCalled()

    // The saved size is kept unless the label is picked; here it is, with a correction.
    const radios = screen.getAllByRole('radio')
    expect(radios.map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false, true, false])
    fireEvent.click(radios[1])
    // Boxes in order: size, size system, care.
    fireEvent.change(screen.getAllByLabelText('fromLabelValue')[0], { target: { value: ' 44 ' } })
    // The size system is new and ticked; untick the care line.
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: 'confirm' }))

    expect(updateMutate.mock.calls[0][0]).toEqual({
      id: 'item-1',
      edits: { tags: { size: '44', size_system: 'EU' } },
    })
  })

  it('takes at most three photos', () => {
    render(<LabelScanDialog item={item()} open onOpenChange={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('addPhoto', { selector: 'input' }), {
      target: { files: [photo('1.jpg'), photo('2.jpg'), photo('3.jpg'), photo('4.jpg')] },
    })

    expect(screen.getAllByRole('img')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: 'addAnother' })).toBeNull()
  })

  it('starts reading at once when photos are handed in', () => {
    scanAnswers({ status: 'read', reading: READING, photos: [] })
    render(<LabelScanDialog item={item()} open onOpenChange={vi.fn()} initialFiles={[photo()]} />)

    expect(scanMutate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'confirm' })).toBeTruthy()
  })

  it('says why nothing could be read, without extra sentences', async () => {
    scanAnswers({ status: 'ai_unreachable', reading: null, photos: [] })
    const onOpenChange = vi.fn()
    render(<LabelScanDialog item={item()} open onOpenChange={onOpenChange} initialFiles={[photo()]} />)

    expect(screen.getByText('unread.ai_unreachable')).toBeTruthy()
    expect(screen.queryByText('photosKept')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'close' }))

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
    expect(updateMutate).not.toHaveBeenCalled()
  })

  it('can go back to the photos and try again after nothing could be read', () => {
    scanAnswers({ status: 'ai_unreachable', reading: null, photos: [] })
    render(<LabelScanDialog item={item()} open onOpenChange={vi.fn()} initialFiles={[photo()]} />)

    fireEvent.click(screen.getByRole('button', { name: 'tryAgain' }))
    expect(screen.queryByText('unread.ai_unreachable')).toBeNull()
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0)
  })
})
