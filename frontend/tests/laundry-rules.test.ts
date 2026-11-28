import { describe, expect, it } from 'vitest'
import { canMove, isAway, laundryOf } from '@/lib/laundry'

describe('laundry states', () => {
  it('turns the two stored halves into one state', () => {
    expect(laundryOf(false, undefined)).toBe('clean')
    expect(laundryOf(true, undefined)).toBe('dirty')
    expect(laundryOf(true, 'wash')).toBe('washing')
    expect(laundryOf(false, 'dry')).toBe('dry_cleaning')
  })

  it('allows only the moves that make sense', () => {
    expect(canMove('dirty', 'wash')).toBe(true)
    expect(canMove('clean', 'dry')).toBe(true)
    expect(canMove('dirty', 'back')).toBe(false)
    expect(canMove('washing', 'wash')).toBe(false)
    expect(canMove('washing', 'back')).toBe(true)
    expect(isAway('dry_cleaning')).toBe(true)
    expect(isAway('dirty')).toBe(false)
  })
})
