import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const post = vi.fn()
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => post(...args) } }))

import { resetWears, settle, undo, UNDO_FOR, wearPhase, wore } from '@/lib/today-wear'

describe('today wear stages', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    post.mockReset()
    post.mockResolvedValue({})
    resetWears()
  })
  afterEach(() => vi.useRealTimers())

  it('waits for Undo, then sends once and stays worn until the outfit says so', async () => {
    wore('o1')
    expect(wearPhase('o1')).toBe('undoable')
    wore('o1')
    await vi.advanceTimersByTimeAsync(UNDO_FOR)
    expect(post).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledWith('/outfits/o1/feedback', { worn: true }, { keepalive: true })
    // No flash back to "not worn" between the send and the refreshed outfit.
    expect(wearPhase('o1')).toBe('sent')
    settle('o1')
    expect(wearPhase('o1')).toBe('idle')
  })

  it('Undo within the wait sends nothing', async () => {
    wore('o1')
    undo('o1')
    await vi.advanceTimersByTimeAsync(UNDO_FOR * 2)
    expect(post).not.toHaveBeenCalled()
    expect(wearPhase('o1')).toBe('idle')
  })

  it('hiding the app sends a waiting wear at once', async () => {
    wore('o1')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.advanceTimersByTimeAsync(0)
    expect(post).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
  })

  it('a failed send goes back to idle and reports the error', async () => {
    post.mockRejectedValueOnce(new Error('offline'))
    const done = vi.fn()
    wore('o1', done)
    await vi.advanceTimersByTimeAsync(UNDO_FOR)
    expect(wearPhase('o1')).toBe('idle')
    expect(done).toHaveBeenCalledWith(false, expect.any(Error))
  })
})
