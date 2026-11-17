import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { OnboardingHomesStep } from '@/components/wardrobe/onboarding-homes-step'

let homes: { id: string; name: string }[] = []

vi.mock('@/lib/hooks/use-homes', () => ({ useHomes: () => ({ data: homes }) }))
vi.mock('@/components/wardrobe/homes-settings', () => ({ HomesSettings: () => <div>homes card</div> }))

beforeEach(() => {
  homes = []
})

describe('OnboardingHomesStep', () => {
  it('waits for a first home, but can be skipped', () => {
    const onNext = vi.fn()
    const onSkip = vi.fn()
    render(<OnboardingHomesStep onNext={onNext} onSkip={onSkip} />)

    expect(screen.getByText('homes card')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'addOneFirst' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'skip' }))
    expect(onSkip).toHaveBeenCalled()
  })

  it('moves on once a home has been added', () => {
    homes = [{ id: 'h1', name: 'Chennai' }]
    const onNext = vi.fn()
    render(<OnboardingHomesStep onNext={onNext} onSkip={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'continue' }))
    expect(onNext).toHaveBeenCalled()
  })
})
